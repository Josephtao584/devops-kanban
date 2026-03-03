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
    private String worktreePath;
    private String branch;
    private String sessionId;      // UUID for WebSocket topic
    private LocalDateTime startedAt;
    private LocalDateTime lastHeartbeat;
    private LocalDateTime stoppedAt;

    public enum SessionStatus {
        CREATED,    // Session created but not started
        RUNNING,    // Agent process is actively running
        IDLE,       // Agent process is waiting for input
        STOPPED,    // Session was manually stopped
        ERROR       // Session encountered an error
    }
}
