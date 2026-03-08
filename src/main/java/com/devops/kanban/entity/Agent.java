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
public class Agent {
    private Long id;
    private Long projectId;
    private String name;
    private AgentType type;
    private String command;
    private boolean enabled;
    private LocalDateTime createdAt;

    public enum AgentType {
        CLAUDE, CODEX, CURSOR, GEMINI, CUSTOM
    }
}
