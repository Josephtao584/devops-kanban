package com.devops.kanban.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SessionDTO {
    private Long id;

    @NotNull(message = "Task ID is required", groups = {Create.class})
    private Long taskId;

    @NotNull(message = "Agent ID is required", groups = {Create.class})
    private Long agentId;

    private String status; // CREATED, RUNNING, IDLE, STOPPED, ERROR
    private String worktreePath;
    private String branch;
    private String sessionId; // WebSocket topic ID
    private LocalDateTime startedAt;
    private LocalDateTime lastHeartbeat;
    private LocalDateTime stoppedAt;
    private String output; // Current output buffer (deprecated)
    private String initialPrompt; // Initial prompt for frontend filtering
    private String claudeSessionId; // Claude CLI native session ID for --resume
    private List<ChatMessageDTO> messages; // Chat message history

    // Validation groups
    public interface Create {}
    public interface Update {}
}
