package com.devops.kanban.service;

import com.devops.kanban.entity.Project;
import com.devops.kanban.infrastructure.git.GitOperations;
import com.devops.kanban.repository.ProjectRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Optional;

import org.eclipse.jgit.diff.DiffEntry;

/**
 * Service for Git operations with project context.
 * Provides business methods that combine project lookup with git operations.
 */
@Service
public class GitService {

    private final GitOperations gitOperations;
    private final ProjectRepository projectRepository;

    @Autowired
    public GitService(GitOperations gitOperations, ProjectRepository projectRepository) {
        this.gitOperations = gitOperations;
        this.projectRepository = projectRepository;
    }

    // ==================== Business Methods ====================

    /**
     * Get the local repository path for a project.
     * @param projectId the project ID
     * @return the Path to the local repository, or current directory if not configured
     * @throws IllegalArgumentException if project not found
     */
    public Path getProjectLocalPath(Long projectId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("Project not found: " + projectId));
        return getRepoPath(project);
    }

    /**
     * Get a project by ID.
     * @param projectId the project ID
     * @return Optional containing the project
     */
    public Optional<Project> getProject(Long projectId) {
        return projectRepository.findById(projectId);
    }

    /**
     * Check if a project has a valid git repository.
     * @param projectId the project ID
     * @return true if the project's local path is a git repository
     */
    public boolean isProjectGitRepository(Long projectId) {
        Path repoPath = getProjectLocalPath(projectId);
        return gitOperations.isGitRepository(repoPath);
    }

    private Path getRepoPath(Project project) {
        if (project.getLocalPath() != null && !project.getLocalPath().isEmpty()) {
            return Paths.get(project.getLocalPath());
        }
        return Paths.get(".");
    }

    // ==================== Delegated Git Operations ====================

    public Path createWorktree(Path mainRepoPath, Long projectId, String branch) {
        return gitOperations.createWorktree(mainRepoPath, projectId, branch);
    }

    public Path createWorktree(Long projectId, String branch) {
        return gitOperations.createWorktree(projectId, branch);
    }

    public List<String> listWorktrees(Path mainRepoPath) {
        return gitOperations.listWorktrees(mainRepoPath);
    }

    public void removeWorktree(Path mainRepoPath, Path worktreePath) {
        gitOperations.removeWorktree(mainRepoPath, worktreePath);
    }

    public void removeWorktree(Path worktreePath) {
        gitOperations.removeWorktree(worktreePath);
    }

    public String getDiff(Path repoPath, String ref1, String ref2) {
        return gitOperations.getDiff(repoPath, ref1, ref2);
    }

    public List<DiffEntry> getDiffEntries(Path repoPath, String ref1, String ref2) {
        return gitOperations.getDiffEntries(repoPath, ref1, ref2);
    }

    public String mergeBranch(Path repoPath, String sourceBranch, String targetBranch) {
        return gitOperations.mergeBranch(repoPath, sourceBranch, targetBranch);
    }

    public void createBranch(Path repoPath, String branchName, String startPoint) {
        gitOperations.createBranch(repoPath, branchName, startPoint);
    }

    public List<String> listBranches(Path repoPath) {
        return gitOperations.listBranches(repoPath);
    }

    public String getCurrentBranch(Path repoPath) {
        return gitOperations.getCurrentBranch(repoPath);
    }

    public void cloneRepository(String repoUrl, Path targetPath) {
        gitOperations.cloneRepository(repoUrl, targetPath);
    }

    public boolean isGitRepository(Path path) {
        return gitOperations.isGitRepository(path);
    }
}
