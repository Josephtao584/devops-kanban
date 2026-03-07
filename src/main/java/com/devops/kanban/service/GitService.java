package com.devops.kanban.service;

import com.devops.kanban.infrastructure.git.GitOperations;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.nio.file.Path;
import java.util.List;

import org.eclipse.jgit.diff.DiffEntry;

/**
 * Backward-compatible wrapper for GitOperations.
 * Delegates all calls to GitOperations.
 *
 * @deprecated Use {@link com.devops.kanban.infrastructure.git.GitOperations} instead.
 */
@Service
@Deprecated
public class GitService {

    private final GitOperations gitOperations;

    @Autowired
    public GitService(GitOperations gitOperations) {
        this.gitOperations = gitOperations;
    }

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
