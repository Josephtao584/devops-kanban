package com.devops.kanban.infrastructure.git;

import com.devops.kanban.dto.BranchDTO;
import com.devops.kanban.dto.CommitDTO;
import com.devops.kanban.dto.GitStatusDTO;
import com.devops.kanban.dto.RemoteDTO;
import com.devops.kanban.dto.WorktreeDTO;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.ListBranchCommand;
import org.eclipse.jgit.api.MergeResult;
import org.eclipse.jgit.api.Status;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.diff.DiffEntry;
import org.eclipse.jgit.diff.DiffFormatter;
import org.eclipse.jgit.lib.BranchTrackingStatus;
import org.eclipse.jgit.lib.ObjectId;
import org.eclipse.jgit.lib.PersonIdent;
import org.eclipse.jgit.lib.Ref;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.lib.StoredConfig;
import org.eclipse.jgit.revwalk.RevCommit;
import org.eclipse.jgit.revwalk.RevTree;
import org.eclipse.jgit.revwalk.RevWalk;
import org.eclipse.jgit.storage.file.FileRepositoryBuilder;
import org.eclipse.jgit.lib.ObjectReader;
import org.eclipse.jgit.transport.RefSpec;
import org.eclipse.jgit.transport.RemoteConfig;
import org.eclipse.jgit.transport.URIish;
import org.eclipse.jgit.treewalk.AbstractTreeIterator;
import org.eclipse.jgit.treewalk.CanonicalTreeParser;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

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

    // ==================== Enhanced Worktree Management ====================

    /**
     * Get detailed status of a worktree
     *
     * @param mainRepoPath the main repository path
     * @param worktreePath the worktree path
     * @return WorktreeDTO with worktree details
     */
    public WorktreeDTO getWorktreeStatus(Path mainRepoPath, Path worktreePath) {
        try (Repository worktreeRepo = openRepository(worktreePath)) {
            try (Git git = new Git(worktreeRepo)) {
                String branch = worktreeRepo.getBranch();
                String headCommitHash = worktreeRepo.resolve("HEAD").getName().substring(0, 8);
                String headCommitMessage = "";

                // Get last commit message
                Iterable<RevCommit> commits = git.log().setMaxCount(1).call();
                for (RevCommit commit : commits) {
                    headCommitMessage = commit.getShortMessage();
                }

                // Check if dirty
                Status status = git.status().call();
                boolean isDirty = !status.isClean();

                // Extract task ID from path if present
                Long taskId = extractTaskIdFromPath(worktreePath);

                return WorktreeDTO.builder()
                        .path(worktreePath.toAbsolutePath().toString())
                        .branch(branch)
                        .headCommitHash(headCommitHash)
                        .headCommitMessage(headCommitMessage)
                        .isDirty(isDirty)
                        .taskId(taskId)
                        .build();
            }
        } catch (Exception e) {
            log.error("Failed to get worktree status: {}", worktreePath, e);
            return null;
        }
    }

    /**
     * List all worktrees with detailed information
     *
     * @param mainRepoPath the main repository path
     * @return list of WorktreeDTO
     */
    public List<WorktreeDTO> listWorktreesDetailed(Path mainRepoPath) {
        List<WorktreeDTO> result = new ArrayList<>();
        try {
            String output = runGitCommandWithOutput(mainRepoPath.toFile(), "worktree", "list", "--porcelain");
            String[] lines = output.split("\n");

            Path currentWorktreePath = null;
            String currentBranch = null;
            String currentHead = null;

            for (String line : lines) {
                if (line.startsWith("worktree ")) {
                    currentWorktreePath = Paths.get(line.substring(9));
                } else if (line.startsWith("HEAD ")) {
                    currentHead = line.substring(5).substring(0, Math.min(8, line.substring(5).length()));
                } else if (line.startsWith("branch ")) {
                    currentBranch = line.substring(7);
                } else if (line.isEmpty() && currentWorktreePath != null) {
                    // End of record, create DTO
                    WorktreeDTO dto = getWorktreeStatus(mainRepoPath, currentWorktreePath);
                    if (dto != null) {
                        result.add(dto);
                    }
                    currentWorktreePath = null;
                    currentBranch = null;
                    currentHead = null;
                }
            }
            // Handle last entry if no trailing newline
            if (currentWorktreePath != null) {
                WorktreeDTO dto = getWorktreeStatus(mainRepoPath, currentWorktreePath);
                if (dto != null) {
                    result.add(dto);
                }
            }
        } catch (Exception e) {
            log.error("Failed to list worktrees detailed", e);
        }
        return result;
    }

    /**
     * Prune stale worktree references
     *
     * @param mainRepoPath the main repository path
     */
    public void pruneWorktrees(Path mainRepoPath) {
        try {
            runGitCommand(mainRepoPath.toFile(), "worktree", "prune", "-v");
            log.info("Pruned worktree references");
        } catch (Exception e) {
            log.error("Failed to prune worktrees", e);
        }
    }

    // ==================== Commit Operations ====================

    /**
     * Commit changes in a repository/worktree
     *
     * @param repoPath the repository path
     * @param message the commit message
     * @param addAll whether to add all changes before committing
     * @param authorName optional author name (null for default)
     * @param authorEmail optional author email (null for default)
     * @return the commit hash
     */
    public String commit(Path repoPath, String message, boolean addAll, String authorName, String authorEmail) {
        try (Repository repository = openRepository(repoPath)) {
            try (Git git = new Git(repository)) {
                if (addAll) {
                    git.add().addFilepattern(".").call();
                }

                var commitCmd = git.commit().setMessage(message);
                if (authorName != null && authorEmail != null) {
                    commitCmd.setAuthor(authorName, authorEmail);
                }

                RevCommit commit = commitCmd.call();
                log.info("Created commit: {} - {}", commit.getName().substring(0, 8), message);
                return commit.getName();
            }
        } catch (Exception e) {
            log.error("Failed to commit changes", e);
            throw new RuntimeException("Failed to commit changes", e);
        }
    }

    /**
     * Get list of uncommitted changes
     *
     * @param repoPath the repository path
     * @return list of changed file paths
     */
    public List<String> getUncommittedChanges(Path repoPath) {
        List<String> changes = new ArrayList<>();
        try (Repository repository = openRepository(repoPath)) {
            try (Git git = new Git(repository)) {
                Status status = git.status().call();
                changes.addAll(status.getAdded());
                changes.addAll(status.getModified());
                changes.addAll(status.getChanged());
                changes.addAll(status.getRemoved());
                changes.addAll(status.getMissing());
                changes.addAll(status.getUntracked());
            }
        } catch (Exception e) {
            log.error("Failed to get uncommitted changes", e);
        }
        return changes;
    }

    // ==================== Branch Management ====================

    /**
     * Delete a branch
     *
     * @param repoPath the repository path
     * @param branchName the branch name to delete
     * @param force whether to force delete (even if not merged)
     */
    public void deleteBranch(Path repoPath, String branchName, boolean force) {
        try (Repository repository = openRepository(repoPath)) {
            try (Git git = new Git(repository)) {
                var deleteCmd = git.branchDelete()
                        .setBranchNames(branchName);
                if (force) {
                    deleteCmd.setForce(true);
                }
                deleteCmd.call();
                log.info("Deleted branch: {} (force={})", branchName, force);
            }
        } catch (Exception e) {
            log.error("Failed to delete branch: {}", branchName, e);
            throw new RuntimeException("Failed to delete branch", e);
        }
    }

    /**
     * List branches with detailed information
     *
     * @param repoPath the repository path
     * @return list of BranchDTO
     */
    public List<BranchDTO> listBranchesDetailed(Path repoPath) {
        List<BranchDTO> result = new ArrayList<>();
        try (Repository repository = openRepository(repoPath)) {
            try (Git git = new Git(repository)) {
                String currentBranch = repository.getBranch();
                List<Ref> branches = git.branchList()
                        .setListMode(ListBranchCommand.ListMode.ALL)
                        .call();

                for (Ref ref : branches) {
                    String fullName = ref.getName();
                    String shortName = fullName.replace("refs/heads/", "")
                            .replace("refs/remotes/", "");
                    boolean isRemote = fullName.startsWith("refs/remotes/");
                    boolean isCurrent = !isRemote && shortName.equals(currentBranch);

                    // Get tracking status for local branches
                    int aheadCount = 0;
                    int behindCount = 0;
                    String upstream = null;

                    if (!isRemote) {
                        BranchTrackingStatus trackingStatus = BranchTrackingStatus.of(repository, shortName);
                        if (trackingStatus != null) {
                            aheadCount = trackingStatus.getAheadCount();
                            behindCount = trackingStatus.getBehindCount();
                            // Get upstream from repository config
                            String mergeBranch = repository.getConfig().getString("branch", shortName, "merge");
                            String remoteName = repository.getConfig().getString("branch", shortName, "remote");
                            if (remoteName != null && mergeBranch != null) {
                                upstream = remoteName + "/" + mergeBranch.replace("refs/heads/", "");
                            }
                        }
                    }

                    // Get last commit info
                    LocalDateTime lastCommitTime = null;
                    String lastCommitMessage = null;
                    try {
                        ObjectId commitId = ref.getObjectId();
                        if (commitId != null) {
                            try (RevWalk walk = new RevWalk(repository)) {
                                RevCommit commit = walk.parseCommit(commitId);
                                lastCommitTime = LocalDateTime.ofInstant(
                                        Instant.ofEpochSecond(commit.getCommitTime()),
                                        ZoneId.systemDefault());
                                lastCommitMessage = commit.getShortMessage();
                            }
                        }
                    } catch (Exception e) {
                        log.debug("Could not get commit info for branch: {}", shortName);
                    }

                    result.add(BranchDTO.builder()
                            .name(shortName)
                            .fullName(fullName)
                            .isCurrent(isCurrent)
                            .isRemote(isRemote)
                            .upstream(upstream)
                            .aheadCount(aheadCount)
                            .behindCount(behindCount)
                            .lastCommit(lastCommitTime)
                            .lastCommitMessage(lastCommitMessage)
                            .build());
                }
            }
        } catch (Exception e) {
            log.error("Failed to list branches detailed", e);
            throw new RuntimeException("Failed to list branches", e);
        }
        return result;
    }

    // ==================== Remote Repository Operations ====================

    /**
     * Push changes to remote
     *
     * @param repoPath the repository path
     * @param remote the remote name (e.g., "origin")
     * @param branch the branch name (can be null to push all branches)
     * @param setUpstream whether to set upstream tracking
     * @return push result message
     */
    public String push(Path repoPath, String remote, String branch, boolean setUpstream) {
        try (Repository repository = openRepository(repoPath)) {
            try (Git git = new Git(repository)) {
                var pushCmd = git.push().setRemote(remote);

                if (branch != null && !branch.isEmpty()) {
                    // Push specific branch
                    String fullBranchName = "refs/heads/" + branch;
                    RefSpec refSpec = new RefSpec(fullBranchName + ":" + fullBranchName);
                    pushCmd.setRefSpecs(refSpec);
                    if (setUpstream) {
                        // Configure upstream tracking in repository config
                        StoredConfig config = repository.getConfig();
                        config.setString("branch", branch, "remote", remote);
                        config.setString("branch", branch, "merge", fullBranchName);
                        config.save();
                    }
                } else if (setUpstream) {
                    pushCmd.setPushAll();
                }

                var results = pushCmd.call();
                StringBuilder sb = new StringBuilder();
                for (var result : results) {
                    sb.append("Pushed to ").append(result.getURI())
                            .append(": ").append(result.getMessages());
                }
                log.info("Push completed: {}", sb);
                return sb.toString();
            }
        } catch (Exception e) {
            log.error("Failed to push", e);
            throw new RuntimeException("Failed to push: " + e.getMessage(), e);
        }
    }

    /**
     * Pull changes from remote
     *
     * @param repoPath the repository path
     * @param remote the remote name
     * @param branch the branch name
     * @return pull result message
     */
    public String pull(Path repoPath, String remote, String branch) {
        try (Repository repository = openRepository(repoPath)) {
            try (Git git = new Git(repository)) {
                var pullResult = git.pull()
                        .setRemote(remote)
                        .setRemoteBranchName(branch)
                        .call();

                if (pullResult.isSuccessful()) {
                    return "Pull successful: " + pullResult.getMergeResult();
                } else {
                    return "Pull failed: " + pullResult.getMergeResult();
                }
            }
        } catch (Exception e) {
            log.error("Failed to pull", e);
            throw new RuntimeException("Failed to pull: " + e.getMessage(), e);
        }
    }

    /**
     * List remote repositories
     *
     * @param repoPath the repository path
     * @return list of RemoteDTO
     */
    public List<RemoteDTO> listRemotes(Path repoPath) {
        List<RemoteDTO> result = new ArrayList<>();
        try (Repository repository = openRepository(repoPath)) {
            StoredConfig config = repository.getConfig();
            for (String remoteName : config.getSubsections("remote")) {
                String fetchUrl = config.getString("remote", remoteName, "url");
                String pushUrl = config.getString("remote", remoteName, "pushurl");
                if (pushUrl == null) {
                    pushUrl = fetchUrl;
                }

                // Get remote branches
                List<String> remoteBranches = new ArrayList<>();
                try (Git git = new Git(repository)) {
                    Map<String, Ref> refs = git.lsRemote().setRemote(remoteName).callAsMap();
                    for (Map.Entry<String, Ref> entry : refs.entrySet()) {
                        if (entry.getKey().startsWith("refs/heads/")) {
                            remoteBranches.add(entry.getKey().replace("refs/heads/", ""));
                        }
                    }
                }

                result.add(RemoteDTO.builder()
                        .name(remoteName)
                        .fetchUrl(fetchUrl)
                        .pushUrl(pushUrl)
                        .branches(remoteBranches)
                        .build());
            }
        } catch (Exception e) {
            log.error("Failed to list remotes", e);
        }
        return result;
    }

    /**
     * Add a remote repository
     *
     * @param repoPath the repository path
     * @param name the remote name
     * @param url the remote URL
     */
    public void addRemote(Path repoPath, String name, String url) {
        try (Repository repository = openRepository(repoPath)) {
            try (Git git = new Git(repository)) {
                RemoteConfig remoteConfig = new RemoteConfig(repository.getConfig(), name);
                remoteConfig.addURI(new URIish(url));
                remoteConfig.update(repository.getConfig());
                repository.getConfig().save();
                log.info("Added remote: {} -> {}", name, url);
            }
        } catch (IOException | URISyntaxException e) {
            log.error("Failed to add remote", e);
            throw new RuntimeException("Failed to add remote", e);
        }
    }

    /**
     * Remove a remote repository
     *
     * @param repoPath the repository path
     * @param name the remote name
     */
    public void removeRemote(Path repoPath, String name) {
        try (Repository repository = openRepository(repoPath)) {
            StoredConfig config = repository.getConfig();
            config.unsetSection("remote", name);
            config.save();
            log.info("Removed remote: {}", name);
        } catch (IOException e) {
            log.error("Failed to remove remote", e);
            throw new RuntimeException("Failed to remove remote", e);
        }
    }

    // ==================== Change Status Query ====================

    /**
     * Get detailed status of repository
     *
     * @param repoPath the repository path
     * @return GitStatusDTO with detailed status
     */
    public GitStatusDTO getStatus(Path repoPath) {
        try (Repository repository = openRepository(repoPath)) {
            try (Git git = new Git(repository)) {
                Status status = git.status().call();
                String branch = repository.getBranch();

                // Build file status lists
                List<GitStatusDTO.FileStatus> added = new ArrayList<>();
                List<GitStatusDTO.FileStatus> modified = new ArrayList<>();
                List<GitStatusDTO.FileStatus> deleted = new ArrayList<>();
                List<GitStatusDTO.FileStatus> untracked = new ArrayList<>();

                for (String file : status.getAdded()) {
                    added.add(GitStatusDTO.FileStatus.builder()
                            .path(file).status("ADDED").build());
                }
                for (String file : status.getModified()) {
                    modified.add(GitStatusDTO.FileStatus.builder()
                            .path(file).status("MODIFIED").build());
                }
                for (String file : status.getChanged()) {
                    modified.add(GitStatusDTO.FileStatus.builder()
                            .path(file).status("STAGED").build());
                }
                for (String file : status.getRemoved()) {
                    deleted.add(GitStatusDTO.FileStatus.builder()
                            .path(file).status("DELETED").build());
                }
                for (String file : status.getMissing()) {
                    deleted.add(GitStatusDTO.FileStatus.builder()
                            .path(file).status("MISSING").build());
                }
                for (String file : status.getUntracked()) {
                    untracked.add(GitStatusDTO.FileStatus.builder()
                            .path(file).status("UNTRACKED").build());
                }

                // Get tracking status
                int aheadCount = 0;
                int behindCount = 0;
                BranchTrackingStatus trackingStatus = BranchTrackingStatus.of(repository, branch);
                if (trackingStatus != null) {
                    aheadCount = trackingStatus.getAheadCount();
                    behindCount = trackingStatus.getBehindCount();
                }

                return GitStatusDTO.builder()
                        .branch(branch)
                        .added(added)
                        .modified(modified)
                        .deleted(deleted)
                        .untracked(untracked)
                        .hasUncommittedChanges(!status.isClean())
                        .aheadCount(aheadCount)
                        .behindCount(behindCount)
                        .build();
            }
        } catch (Exception e) {
            log.error("Failed to get status", e);
            throw new RuntimeException("Failed to get status", e);
        }
    }

    /**
     * Get commit history
     *
     * @param repoPath the repository path
     * @param maxCount maximum number of commits to return
     * @return list of CommitDTO
     */
    public List<CommitDTO> getLog(Path repoPath, int maxCount) {
        List<CommitDTO> result = new ArrayList<>();
        try (Repository repository = openRepository(repoPath)) {
            try (Git git = new Git(repository)) {
                Iterable<RevCommit> commits = git.log().setMaxCount(maxCount).call();
                for (RevCommit commit : commits) {
                    PersonIdent author = commit.getAuthorIdent();
                    List<String> parents = new ArrayList<>();
                    for (RevCommit parent : commit.getParents()) {
                        parents.add(parent.getName().substring(0, 8));
                    }

                    result.add(CommitDTO.builder()
                            .hash(commit.getName())
                            .shortHash(commit.getName().substring(0, 8))
                            .message(commit.getFullMessage())
                            .author(author.getName())
                            .authorEmail(author.getEmailAddress())
                            .timestamp(LocalDateTime.ofInstant(
                                    Instant.ofEpochSecond(commit.getCommitTime()),
                                    ZoneId.systemDefault()))
                            .parentHashes(parents)
                            .build());
                }
            }
        } catch (Exception e) {
            log.error("Failed to get log", e);
        }
        return result;
    }

    /**
     * Get diff for uncommitted changes
     *
     * @param repoPath the repository path
     * @return diff content as string
     */
    public String getUncommittedDiff(Path repoPath) {
        try (Repository repository = openRepository(repoPath)) {
            try (Git git = new Git(repository)) {
                ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
                try (DiffFormatter formatter = new DiffFormatter(outputStream)) {
                    formatter.setRepository(repository);

                    // Get diff between HEAD and working tree
                    ObjectId head = repository.resolve("HEAD");
                    if (head != null) {
                        List<DiffEntry> diffs = git.diff()
                                .setOldTree(prepareTreeParserFromCommit(repository, head))
                                .call();
                        for (DiffEntry entry : diffs) {
                            formatter.format(entry);
                        }
                    } else {
                        // No commits yet, show all untracked files
                        List<DiffEntry> diffs = git.diff().call();
                        for (DiffEntry entry : diffs) {
                            formatter.format(entry);
                        }
                    }
                }
                return outputStream.toString(StandardCharsets.UTF_8);
            }
        } catch (Exception e) {
            log.error("Failed to get uncommitted diff", e);
            return "";
        }
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

    private Long extractTaskIdFromPath(Path worktreePath) {
        // Extract task ID from path pattern: task-{taskId}-{uuid}
        String dirName = worktreePath.getFileName().toString();
        Pattern pattern = Pattern.compile("task-(\\d+)-[a-f0-9]+");
        Matcher matcher = pattern.matcher(dirName);
        if (matcher.matches()) {
            return Long.parseLong(matcher.group(1));
        }
        return null;
    }

    // Compatibility method for old API
    public Path createWorktree(Long projectId, String branch) {
        return createWorktree(Paths.get("."), projectId, branch);
    }

    public void removeWorktree(Path worktreePath) {
        removeWorktree(Paths.get("."), worktreePath);
    }
}
