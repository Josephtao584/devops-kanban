package com.devops.kanban.controller;

import com.devops.kanban.dto.*;
import com.devops.kanban.infrastructure.git.GitOperations;
import com.devops.kanban.service.GitService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/git")
@RequiredArgsConstructor
@CrossOrigin(origins = "${app.cors.origins:http://localhost:5173}")
public class GitController {

    private final GitOperations gitOperations;
    private final GitService gitService;

    // ==================== Worktree Management ====================

    @GetMapping("/worktrees")
    public ResponseEntity<ApiResponse<List<WorktreeDTO>>> listWorktreesDetailed(@RequestParam Long projectId) {
        try {
            Path repoPath = gitService.getProjectLocalPath(projectId);
            if (!gitOperations.isGitRepository(repoPath)) {
                return ResponseEntity.ok(ApiResponse.error("Not a valid Git repository"));
            }

            List<WorktreeDTO> worktrees = gitOperations.listWorktreesDetailed(repoPath);
            return ResponseEntity.ok(ApiResponse.success(worktrees));
        } catch (Exception e) {
            return ResponseEntity.ok(ApiResponse.error("Failed to list worktrees: " + e.getMessage()));
        }
    }

    @GetMapping("/worktrees/{taskId}")
    public ResponseEntity<ApiResponse<WorktreeDTO>> getWorktreeStatus(
            @RequestParam Long projectId,
            @PathVariable Long taskId) {
        try {
            Path repoPath = gitService.getProjectLocalPath(projectId);
            if (!gitOperations.isGitRepository(repoPath)) {
                return ResponseEntity.ok(ApiResponse.error("Not a valid Git repository"));
            }

            // Find worktree for the task
            List<WorktreeDTO> worktrees = gitOperations.listWorktreesDetailed(repoPath);
            WorktreeDTO worktree = worktrees.stream()
                    .filter(w -> taskId.equals(w.getTaskId()))
                    .findFirst()
                    .orElse(null);

            if (worktree == null) {
                return ResponseEntity.ok(ApiResponse.error("Worktree not found for task: " + taskId));
            }
            return ResponseEntity.ok(ApiResponse.success(worktree));
        } catch (Exception e) {
            return ResponseEntity.ok(ApiResponse.error("Failed to get worktree status: " + e.getMessage()));
        }
    }

    @PostMapping("/worktrees/prune")
    public ResponseEntity<ApiResponse<String>> pruneWorktrees(@RequestParam Long projectId) {
        try {
            Path repoPath = gitService.getProjectLocalPath(projectId);
            if (!gitOperations.isGitRepository(repoPath)) {
                return ResponseEntity.ok(ApiResponse.error("Not a valid Git repository"));
            }

            gitOperations.pruneWorktrees(repoPath);
            return ResponseEntity.ok(ApiResponse.success("Worktree references pruned successfully"));
        } catch (Exception e) {
            return ResponseEntity.ok(ApiResponse.error("Failed to prune worktrees: " + e.getMessage()));
        }
    }

    // ==================== Commit Operations ====================

    @PostMapping("/worktrees/{taskId}/commit")
    public ResponseEntity<ApiResponse<Map<String, String>>> commit(
            @RequestParam Long projectId,
            @PathVariable Long taskId,
            @RequestBody CommitRequestDTO request) {
        try {
            Path repoPath = gitService.getProjectLocalPath(projectId);
            if (!gitOperations.isGitRepository(repoPath)) {
                return ResponseEntity.ok(ApiResponse.error("Not a valid Git repository"));
            }

            // Find worktree for the task
            List<WorktreeDTO> worktrees = gitOperations.listWorktreesDetailed(repoPath);
            WorktreeDTO worktree = worktrees.stream()
                    .filter(w -> taskId.equals(w.getTaskId()))
                    .findFirst()
                    .orElse(null);

            if (worktree == null) {
                return ResponseEntity.ok(ApiResponse.error("Worktree not found for task: " + taskId));
            }

            Path worktreePath = Paths.get(worktree.getPath());
            String commitHash = gitOperations.commit(
                    worktreePath,
                    request.getMessage(),
                    request.isAddAll(),
                    request.getAuthorName(),
                    request.getAuthorEmail());

            Map<String, String> result = new HashMap<>();
            result.put("commitHash", commitHash);
            result.put("shortHash", commitHash.substring(0, 8));
            return ResponseEntity.ok(ApiResponse.success("Commit created successfully", result));
        } catch (Exception e) {
            return ResponseEntity.ok(ApiResponse.error("Failed to commit: " + e.getMessage()));
        }
    }

    @GetMapping("/worktrees/{taskId}/changes")
    public ResponseEntity<ApiResponse<List<String>>> getUncommittedChanges(
            @RequestParam Long projectId,
            @PathVariable Long taskId) {
        try {
            Path repoPath = gitService.getProjectLocalPath(projectId);
            if (!gitOperations.isGitRepository(repoPath)) {
                return ResponseEntity.ok(ApiResponse.error("Not a valid Git repository"));
            }

            // Find worktree for the task
            List<WorktreeDTO> worktrees = gitOperations.listWorktreesDetailed(repoPath);
            WorktreeDTO worktree = worktrees.stream()
                    .filter(w -> taskId.equals(w.getTaskId()))
                    .findFirst()
                    .orElse(null);

            if (worktree == null) {
                return ResponseEntity.ok(ApiResponse.error("Worktree not found for task: " + taskId));
            }

            Path worktreePath = Paths.get(worktree.getPath());
            List<String> changes = gitOperations.getUncommittedChanges(worktreePath);
            return ResponseEntity.ok(ApiResponse.success(changes));
        } catch (Exception e) {
            return ResponseEntity.ok(ApiResponse.error("Failed to get changes: " + e.getMessage()));
        }
    }

    // ==================== Branch Management ====================

    @GetMapping("/branches")
    public ResponseEntity<ApiResponse<List<BranchDTO>>> getBranchesDetailed(@RequestParam Long projectId) {
        try {
            Path repoPath = gitService.getProjectLocalPath(projectId);
            if (!gitOperations.isGitRepository(repoPath)) {
                return ResponseEntity.ok(ApiResponse.error("Not a valid Git repository"));
            }

            List<BranchDTO> branches = gitOperations.listBranchesDetailed(repoPath);
            return ResponseEntity.ok(ApiResponse.success(branches));
        } catch (Exception e) {
            return ResponseEntity.ok(ApiResponse.error("Failed to list branches: " + e.getMessage()));
        }
    }

    @PostMapping("/branches")
    public ResponseEntity<ApiResponse<String>> createBranch(
            @RequestParam Long projectId,
            @RequestParam String name,
            @RequestParam(required = false) String startPoint) {
        try {
            Path repoPath = gitService.getProjectLocalPath(projectId);
            if (!gitOperations.isGitRepository(repoPath)) {
                return ResponseEntity.ok(ApiResponse.error("Not a valid Git repository"));
            }

            String start = startPoint != null ? startPoint : "HEAD";
            gitOperations.createBranch(repoPath, name, start);
            return ResponseEntity.ok(ApiResponse.success("Branch created: " + name));
        } catch (Exception e) {
            return ResponseEntity.ok(ApiResponse.error("Failed to create branch: " + e.getMessage()));
        }
    }

    @DeleteMapping("/branches/{branchName}")
    public ResponseEntity<ApiResponse<String>> deleteBranch(
            @RequestParam Long projectId,
            @PathVariable String branchName,
            @RequestParam(required = false, defaultValue = "false") boolean force) {
        try {
            Path repoPath = gitService.getProjectLocalPath(projectId);
            if (!gitOperations.isGitRepository(repoPath)) {
                return ResponseEntity.ok(ApiResponse.error("Not a valid Git repository"));
            }

            gitOperations.deleteBranch(repoPath, branchName, force);
            return ResponseEntity.ok(ApiResponse.success("Branch deleted: " + branchName));
        } catch (Exception e) {
            return ResponseEntity.ok(ApiResponse.error("Failed to delete branch: " + e.getMessage()));
        }
    }

    @PostMapping("/branches/{source}/merge/{target}")
    public ResponseEntity<ApiResponse<String>> mergeBranch(
            @RequestParam Long projectId,
            @PathVariable String source,
            @PathVariable String target) {
        try {
            Path repoPath = gitService.getProjectLocalPath(projectId);
            if (!gitOperations.isGitRepository(repoPath)) {
                return ResponseEntity.ok(ApiResponse.error("Not a valid Git repository"));
            }

            String result = gitOperations.mergeBranch(repoPath, source, target);
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            return ResponseEntity.ok(ApiResponse.error("Failed to merge: " + e.getMessage()));
        }
    }

    // ==================== Remote Operations ====================

    @GetMapping("/remotes")
    public ResponseEntity<ApiResponse<List<RemoteDTO>>> listRemotes(@RequestParam Long projectId) {
        try {
            Path repoPath = gitService.getProjectLocalPath(projectId);
            if (!gitOperations.isGitRepository(repoPath)) {
                return ResponseEntity.ok(ApiResponse.error("Not a valid Git repository"));
            }

            List<RemoteDTO> remotes = gitOperations.listRemotes(repoPath);
            return ResponseEntity.ok(ApiResponse.success(remotes));
        } catch (Exception e) {
            return ResponseEntity.ok(ApiResponse.error("Failed to list remotes: " + e.getMessage()));
        }
    }

    @PostMapping("/remotes")
    public ResponseEntity<ApiResponse<String>> addRemote(
            @RequestParam Long projectId,
            @RequestParam String name,
            @RequestParam String url) {
        try {
            Path repoPath = gitService.getProjectLocalPath(projectId);
            if (!gitOperations.isGitRepository(repoPath)) {
                return ResponseEntity.ok(ApiResponse.error("Not a valid Git repository"));
            }

            gitOperations.addRemote(repoPath, name, url);
            return ResponseEntity.ok(ApiResponse.success("Remote added: " + name));
        } catch (Exception e) {
            return ResponseEntity.ok(ApiResponse.error("Failed to add remote: " + e.getMessage()));
        }
    }

    @DeleteMapping("/remotes/{name}")
    public ResponseEntity<ApiResponse<String>> removeRemote(
            @RequestParam Long projectId,
            @PathVariable String name) {
        try {
            Path repoPath = gitService.getProjectLocalPath(projectId);
            if (!gitOperations.isGitRepository(repoPath)) {
                return ResponseEntity.ok(ApiResponse.error("Not a valid Git repository"));
            }

            gitOperations.removeRemote(repoPath, name);
            return ResponseEntity.ok(ApiResponse.success("Remote removed: " + name));
        } catch (Exception e) {
            return ResponseEntity.ok(ApiResponse.error("Failed to remove remote: " + e.getMessage()));
        }
    }

    @PostMapping("/worktrees/{taskId}/push")
    public ResponseEntity<ApiResponse<String>> push(
            @RequestParam Long projectId,
            @PathVariable Long taskId,
            @RequestBody(required = false) Map<String, Object> body) {
        try {
            Path repoPath = gitService.getProjectLocalPath(projectId);
            if (!gitOperations.isGitRepository(repoPath)) {
                return ResponseEntity.ok(ApiResponse.error("Not a valid Git repository"));
            }

            // Find worktree for the task
            List<WorktreeDTO> worktrees = gitOperations.listWorktreesDetailed(repoPath);
            WorktreeDTO worktree = worktrees.stream()
                    .filter(w -> taskId.equals(w.getTaskId()))
                    .findFirst()
                    .orElse(null);

            if (worktree == null) {
                return ResponseEntity.ok(ApiResponse.error("Worktree not found for task: " + taskId));
            }

            String remote = body != null ? (String) body.getOrDefault("remote", "origin") : "origin";
            boolean setUpstream = body != null && Boolean.TRUE.equals(body.get("setUpstream"));

            Path worktreePath = Paths.get(worktree.getPath());
            String result = gitOperations.push(worktreePath, remote, worktree.getBranch(), setUpstream);
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            return ResponseEntity.ok(ApiResponse.error("Failed to push: " + e.getMessage()));
        }
    }

    @PostMapping("/worktrees/{taskId}/pull")
    public ResponseEntity<ApiResponse<String>> pull(
            @RequestParam Long projectId,
            @PathVariable Long taskId,
            @RequestBody(required = false) Map<String, Object> body) {
        try {
            Path repoPath = gitService.getProjectLocalPath(projectId);
            if (!gitOperations.isGitRepository(repoPath)) {
                return ResponseEntity.ok(ApiResponse.error("Not a valid Git repository"));
            }

            // Find worktree for the task
            List<WorktreeDTO> worktrees = gitOperations.listWorktreesDetailed(repoPath);
            WorktreeDTO worktree = worktrees.stream()
                    .filter(w -> taskId.equals(w.getTaskId()))
                    .findFirst()
                    .orElse(null);

            if (worktree == null) {
                return ResponseEntity.ok(ApiResponse.error("Worktree not found for task: " + taskId));
            }

            String remote = body != null ? (String) body.getOrDefault("remote", "origin") : "origin";

            Path worktreePath = Paths.get(worktree.getPath());
            String result = gitOperations.pull(worktreePath, remote, worktree.getBranch());
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            return ResponseEntity.ok(ApiResponse.error("Failed to pull: " + e.getMessage()));
        }
    }

    // ==================== Status Query ====================

    @GetMapping("/worktrees/{taskId}/status")
    public ResponseEntity<ApiResponse<GitStatusDTO>> getStatus(
            @RequestParam Long projectId,
            @PathVariable Long taskId) {
        try {
            Path repoPath = gitService.getProjectLocalPath(projectId);
            if (!gitOperations.isGitRepository(repoPath)) {
                return ResponseEntity.ok(ApiResponse.error("Not a valid Git repository"));
            }

            // Find worktree for the task
            List<WorktreeDTO> worktrees = gitOperations.listWorktreesDetailed(repoPath);
            WorktreeDTO worktree = worktrees.stream()
                    .filter(w -> taskId.equals(w.getTaskId()))
                    .findFirst()
                    .orElse(null);

            if (worktree == null) {
                return ResponseEntity.ok(ApiResponse.error("Worktree not found for task: " + taskId));
            }

            Path worktreePath = Paths.get(worktree.getPath());
            GitStatusDTO status = gitOperations.getStatus(worktreePath);
            return ResponseEntity.ok(ApiResponse.success(status));
        } catch (Exception e) {
            return ResponseEntity.ok(ApiResponse.error("Failed to get status: " + e.getMessage()));
        }
    }

    @GetMapping("/worktrees/{taskId}/diff")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getDiff(
            @RequestParam Long projectId,
            @PathVariable Long taskId,
            @RequestParam(required = false) String source,
            @RequestParam(required = false) String target) {
        try {
            Path repoPath = gitService.getProjectLocalPath(projectId);
            if (!gitOperations.isGitRepository(repoPath)) {
                return ResponseEntity.ok(ApiResponse.error("Not a valid Git repository"));
            }

            // Find worktree for the task
            List<WorktreeDTO> worktrees = gitOperations.listWorktreesDetailed(repoPath);
            WorktreeDTO worktree = worktrees.stream()
                    .filter(w -> taskId.equals(w.getTaskId()))
                    .findFirst()
                    .orElse(null);

            if (worktree == null) {
                return ResponseEntity.ok(ApiResponse.error("Worktree not found for task: " + taskId));
            }

            Path worktreePath = Paths.get(worktree.getPath());
            String diff;
            if (source != null && target != null) {
                diff = gitOperations.getDiff(worktreePath, source, target);
            } else {
                diff = gitOperations.getUncommittedDiff(worktreePath);
            }

            Map<String, Object> result = new HashMap<>();
            result.put("content", diff);
            result.put("taskId", taskId);
            result.put("branch", worktree.getBranch());
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            return ResponseEntity.ok(ApiResponse.error("Failed to get diff: " + e.getMessage()));
        }
    }

    @GetMapping("/worktrees/{taskId}/log")
    public ResponseEntity<ApiResponse<List<CommitDTO>>> getLog(
            @RequestParam Long projectId,
            @PathVariable Long taskId,
            @RequestParam(required = false, defaultValue = "10") int limit) {
        try {
            Path repoPath = gitService.getProjectLocalPath(projectId);
            if (!gitOperations.isGitRepository(repoPath)) {
                return ResponseEntity.ok(ApiResponse.error("Not a valid Git repository"));
            }

            // Find worktree for the task
            List<WorktreeDTO> worktrees = gitOperations.listWorktreesDetailed(repoPath);
            WorktreeDTO worktree = worktrees.stream()
                    .filter(w -> taskId.equals(w.getTaskId()))
                    .findFirst()
                    .orElse(null);

            if (worktree == null) {
                return ResponseEntity.ok(ApiResponse.error("Worktree not found for task: " + taskId));
            }

            Path worktreePath = Paths.get(worktree.getPath());
            List<CommitDTO> commits = gitOperations.getLog(worktreePath, limit);
            return ResponseEntity.ok(ApiResponse.success(commits));
        } catch (Exception e) {
            return ResponseEntity.ok(ApiResponse.error("Failed to get log: " + e.getMessage()));
        }
    }

    // Legacy endpoint for backward compatibility
    @GetMapping("/diff")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getDiffLegacy(
            @RequestParam Long projectId,
            @RequestParam String source,
            @RequestParam String target) {
        try {
            Path repoPath = gitService.getProjectLocalPath(projectId);
            if (!gitOperations.isGitRepository(repoPath)) {
                return ResponseEntity.ok(ApiResponse.error("Not a valid Git repository"));
            }

            String diff = gitOperations.getDiff(repoPath, source, target);
            var diffEntries = gitOperations.getDiffEntries(repoPath, source, target);

            Map<String, Object> result = new HashMap<>();
            result.put("content", diff);
            result.put("filesChanged", diffEntries.size());
            result.put("source", source);
            result.put("target", target);

            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            return ResponseEntity.ok(ApiResponse.error("Failed to get diff: " + e.getMessage()));
        }
    }
}
