package com.devops.kanban.entity;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Session {
    private Long id;
    private Long taskId;
    private Long agentId;
    private SessionStatus status;
    /**
     * For Git projects: path to the isolated Git worktree.
     * For non-Git projects: path to the project's local directory (used directly without worktree).
     */
    private String worktreePath;
    private String branch;
    private String sessionId;      // UUID for WebSocket topic
    private String claudeSessionId; // Claude CLI's native session ID for --resume
    private LocalDateTime startedAt;
    private LocalDateTime lastHeartbeat;
    private LocalDateTime stoppedAt;
    private String output;  // Conversation history/output buffer (deprecated, use messages)
    private String initialPrompt;  // Initial prompt passed to Claude CLI (for frontend filtering)
    private String messages;  // JSON array of chat messages

    // Phase transition fields
    private Boolean phaseCompleteSignal;  // Whether AI has signaled phase completion
    private String targetPhase;            // AI-suggested next phase

    public enum SessionStatus {
        CREATED,    // Session created but not started
        RUNNING,    // Agent process is actively running
        IDLE,       // Agent process is waiting for input
        STOPPED,    // Session was manually stopped
        ERROR       // Session encountered an error
    }
}
