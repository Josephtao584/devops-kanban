package com.devops.kanban.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AgentDTO {
    private Long id;

    // Agents are global, not project-specific
    private Long projectId;

    @NotBlank(message = "Name is required")
    private String name;

    @NotBlank(message = "Type is required")
    private String type; // CLAUDE, CODEX, CURSOR, GEMINI, CUSTOM

    private String command; // execution command template
    private String config; // JSON config
    private boolean enabled;
    private LocalDateTime createdAt;
}
