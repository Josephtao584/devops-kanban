package com.devops.kanban.infrastructure.git;

import lombok.extern.slf4j.Slf4j;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.ListBranchCommand;
import org.eclipse.jgit.api.MergeResult;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.diff.DiffEntry;
import org.eclipse.jgit.diff.DiffFormatter;
import org.eclipse.jgit.lib.ObjectId;
import org.eclipse.jgit.lib.Ref;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.revwalk.RevCommit;
import org.eclipse.jgit.revwalk.RevTree;
import org.eclipse.jgit.revwalk.RevWalk;
import org.eclipse.jgit.storage.file.FileRepositoryBuilder;
import org.eclipse.jgit.lib.ObjectReader;
import org.eclipse.jgit.treewalk.AbstractTreeIterator;
import org.eclipse.jgit.treewalk.CanonicalTreeParser;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Service for managing Git operations including worktrees for isolated task execution.
 * Uses JGit for programmatic Git operations.
 */
@Service
@Slf4j
public class GitOperations {

    private final Path worktreesDir;

    public GitOperations(@Value("${app.storage.path:./data}") String storagePath) {
        this.worktreesDir = Paths.get(storagePath, "worktrees");
    }

    /**
     * Create a new git worktree for isolated task execution
     *
     * @param mainRepoPath the path to the main repository
     * @param projectId the project ID
     * @param branch the branch name
     * @return the path to the worktree
     */
    public Path createWorktree(Path mainRepoPath, Long projectId, String branch) {
        try {
            // Create worktrees directory inside the project's repo
            Path projectWorktreesDir = mainRepoPath.resolve("data").resolve("worktrees");
            Files.createDirectories(projectWorktreesDir);

            String worktreeName = "task-" + projectId + "-" + UUID.randomUUID().toString().substring(0, 8);
            Path worktreePath = projectWorktreesDir.resolve(worktreeName);

            Repository mainRepo = openRepository(mainRepoPath);
            try (Git git = new Git(mainRepo)) {
                // Create worktree using git worktree add command
                // JGit doesn't directly support worktree, so we use process command
                runGitCommand(mainRepoPath.toFile(), "worktree", "add", "-b", branch, worktreePath.toString());
                log.info("Created worktree at: {} with branch: {}", worktreePath, branch);
            }

            // Return absolute path
            return worktreePath.toAbsolutePath();

        } catch (Exception e) {
            throw new RuntimeException("Failed to create worktree", e);
        }
    }

    /**
     * List all worktrees for a repository
     *
     * @param mainRepoPath the path to the main repository
     * @return list of worktree paths
     */
    public List<String> listWorktrees(Path mainRepoPath) {
        List<String> worktrees = new ArrayList<>();
        try {
            String output = runGitCommandWithOutput(mainRepoPath.toFile(), "worktree", "list");
            String[] lines = output.split("\n");
            for (String line : lines) {
                if (!line.isEmpty()) {
                    String[] parts = line.split("\\s+");
                    if (parts.length > 0) {
                        worktrees.add(parts[0]);
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Failed to list worktrees", e);
        }
        return worktrees;
    }

    /**
     * Remove a git worktree
     *
     * @param mainRepoPath the path to the main repository
     * @param worktreePath the path to the worktree
     */
    public void removeWorktree(Path mainRepoPath, Path worktreePath) {
        try {
            runGitCommand(mainRepoPath.toFile(), "worktree", "remove", worktreePath.toString());
            log.info("Removed worktree at: {}", worktreePath);
        } catch (Exception e) {
            log.warn("Failed to remove worktree: {}, forcing removal", worktreePath);
            try {
                runGitCommand(mainRepoPath.toFile(), "worktree", "remove", "--force", worktreePath.toString());
            } catch (Exception ex) {
                log.error("Failed to force remove worktree", ex);
            }
        }
    }

    /**
     * Get diff between two branches or commits
     *
     * @param repoPath the repository path
     * @param ref1 the first reference (branch/commit)
     * @param ref2 the second reference (branch/commit)
     * @return the diff output
     */
    public String getDiff(Path repoPath, String ref1, String ref2) {
        try (Repository repository = openRepository(repoPath)) {
            try (Git git = new Git(repository)) {
                AbstractTreeIterator treeParser1 = prepareTreeParser(repository, ref1);
                AbstractTreeIterator treeParser2 = prepareTreeParser(repository, ref2);

                List<DiffEntry> diffs = git.diff()
                        .setOldTree(treeParser1)
                        .setNewTree(treeParser2)
                        .call();

                ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
                try (DiffFormatter formatter = new DiffFormatter(outputStream)) {
                    formatter.setRepository(repository);
                    for (DiffEntry entry : diffs) {
                        formatter.format(entry);
                    }
                }
                return outputStream.toString(StandardCharsets.UTF_8);
            }
        } catch (Exception e) {
            log.error("Failed to get diff between {} and {}", ref1, ref2, e);
            throw new RuntimeException("Failed to get diff", e);
        }
    }

    /**
     * Get diff statistics between two branches or commits
     *
     * @param repoPath the repository path
     * @param ref1 the first reference
     * @param ref2 the second reference
     * @return list of changed files with statistics
     */
    public List<DiffEntry> getDiffEntries(Path repoPath, String ref1, String ref2) {
        try (Repository repository = openRepository(repoPath)) {
            try (Git git = new Git(repository)) {
                AbstractTreeIterator treeParser1 = prepareTreeParser(repository, ref1);
                AbstractTreeIterator treeParser2 = prepareTreeParser(repository, ref2);

                return git.diff()
                        .setOldTree(treeParser1)
                        .setNewTree(treeParser2)
                        .call();
            }
        } catch (Exception e) {
            log.error("Failed to get diff entries", e);
            throw new RuntimeException("Failed to get diff entries", e);
        }
    }

    /**
     * Merge a branch into another branch
     *
     * @param repoPath the repository path
     * @param sourceBranch the source branch to merge from
     * @param targetBranch the target branch to merge into
     * @return merge result message
     */
    public String mergeBranch(Path repoPath, String sourceBranch, String targetBranch) {
        try (Repository repository = openRepository(repoPath)) {
            try (Git git = new Git(repository)) {
                // Checkout target branch
                git.checkout().setName(targetBranch).call();

                // Get source branch ref
                Ref sourceRef = repository.findRef(sourceBranch);
                if (sourceRef == null) {
                    throw new RuntimeException("Source branch not found: " + sourceBranch);
                }

                // Merge
                MergeResult result = git.merge()
                        .include(sourceRef)
                        .call();

                return switch (result.getMergeStatus()) {
                    case FAST_FORWARD -> "Fast-forward merge successful";
                    case MERGED -> "Merge successful";
                    case CONFLICTING -> "Merge has conflicts: " + result.getConflicts();
                    default -> "Merge status: " + result.getMergeStatus();
                };
            }
        } catch (Exception e) {
            log.error("Failed to merge {} into {}", sourceBranch, targetBranch, e);
            throw new RuntimeException("Failed to merge branches", e);
        }
    }

    /**
     * Create a new branch
     *
     * @param repoPath the repository path
     * @param branchName the branch name
     * @param startPoint the starting point (commit or branch)
     */
    public void createBranch(Path repoPath, String branchName, String startPoint) {
        try (Repository repository = openRepository(repoPath)) {
            try (Git git = new Git(repository)) {
                git.branchCreate()
                        .setName(branchName)
                        .setStartPoint(startPoint)
                        .call();
                log.info("Created branch: {} from {}", branchName, startPoint);
            }
        } catch (Exception e) {
            log.error("Failed to create branch: {}", branchName, e);
            throw new RuntimeException("Failed to create branch", e);
        }
    }

    /**
     * List all branches
     *
     * @param repoPath the repository path
     * @return list of branch names
     */
    public List<String> listBranches(Path repoPath) {
        try (Repository repository = openRepository(repoPath)) {
            try (Git git = new Git(repository)) {
                List<Ref> branches = git.branchList()
                        .setListMode(ListBranchCommand.ListMode.ALL)
                        .call();
                return branches.stream()
                        .map(ref -> ref.getName().replace("refs/heads/", "").replace("refs/remotes/", ""))
                        .distinct()
                        .toList();
            }
        } catch (Exception e) {
            log.error("Failed to list branches", e);
            throw new RuntimeException("Failed to list branches", e);
        }
    }

    /**
     * Get current branch name
     *
     * @param repoPath the repository path
     * @return the current branch name
     */
    public String getCurrentBranch(Path repoPath) {
        try (Repository repository = openRepository(repoPath)) {
            return repository.getBranch();
        } catch (Exception e) {
            log.error("Failed to get current branch", e);
            return "unknown";
        }
    }

    /**
     * Clone a repository
     *
     * @param repoUrl the repository URL
     * @param targetPath the target path
     */
    public void cloneRepository(String repoUrl, Path targetPath) {
        try {
            Git.cloneRepository()
                    .setURI(repoUrl)
                    .setDirectory(targetPath.toFile())
                    .call()
                    .close();
            log.info("Cloned repository from {} to {}", repoUrl, targetPath);
        } catch (GitAPIException e) {
            log.error("Failed to clone repository: {}", repoUrl, e);
            throw new RuntimeException("Failed to clone repository", e);
        }
    }

    /**
     * Check if a path is a valid Git repository
     *
     * @param path the path to check
     * @return true if it's a Git repository
     */
    public boolean isGitRepository(Path path) {
        File gitDir = path.resolve(".git").toFile();
        return gitDir.exists() && gitDir.isDirectory();
    }

    // Private helper methods

    private Repository openRepository(Path repoPath) throws IOException {
        FileRepositoryBuilder builder = new FileRepositoryBuilder();
        return builder.setGitDir(repoPath.resolve(".git").toFile())
                .readEnvironment()
                .findGitDir()
                .build();
    }

    private AbstractTreeIterator prepareTreeParser(Repository repository, String ref) throws IOException {
        Ref head = repository.findRef(ref);
        if (head == null) {
            // Try as commit hash
            ObjectId commitId = repository.resolve(ref);
            if (commitId == null) {
                throw new RuntimeException("Reference not found: " + ref);
            }
            return prepareTreeParserFromCommit(repository, commitId);
        }
        return prepareTreeParserFromCommit(repository, head.getObjectId());
    }

    private AbstractTreeIterator prepareTreeParserFromCommit(Repository repository, ObjectId commitId) throws IOException {
        try (RevWalk walk = new RevWalk(repository)) {
            RevCommit commit = walk.parseCommit(commitId);
            RevTree tree = walk.parseTree(commit.getTree().getId());

            CanonicalTreeParser treeParser = new CanonicalTreeParser();
            try (ObjectReader reader = repository.newObjectReader()) {
                treeParser.reset(reader, tree.getId());
            }

            walk.dispose();
            return treeParser;
        }
    }

    private void runGitCommand(File directory, String... args) throws Exception {
        ProcessBuilder pb = new ProcessBuilder(buildGitCommand(args));
        pb.directory(directory);
        pb.redirectErrorStream(true);

        Process process = pb.start();
        int exitCode = process.waitFor();

        if (exitCode != 0) {
            throw new RuntimeException("Git command failed with exit code: " + exitCode);
        }
    }

    private String runGitCommandWithOutput(File directory, String... args) throws Exception {
        ProcessBuilder pb = new ProcessBuilder(buildGitCommand(args));
        pb.directory(directory);
        pb.redirectErrorStream(true);

        Process process = pb.start();
        StringBuilder output = new StringBuilder();

        try (var reader = new java.io.BufferedReader(new java.io.InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
            }
        }

        process.waitFor();
        return output.toString();
    }

    private List<String> buildGitCommand(String... args) {
        List<String> command = new ArrayList<>();
        command.add("git");
        command.addAll(List.of(args));
        return command;
    }

    // Compatibility method for old API
    public Path createWorktree(Long projectId, String branch) {
        return createWorktree(Paths.get("."), projectId, branch);
    }

    public void removeWorktree(Path worktreePath) {
        removeWorktree(Paths.get("."), worktreePath);
    }
}
