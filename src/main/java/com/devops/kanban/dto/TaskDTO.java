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
public class TaskDTO {
    private Long id;

    @NotNull(message = "Project ID is required")
    private Long projectId;

    @NotBlank(message = "Task title is required")
    private String title;

    private String description;
    private String status;
    private String priority;
    private String assignee;

    // External task source fields
    private Long sourceId;
    private String externalId;
    private LocalDateTime syncedAt;

    // Phase transition control
    private Boolean autoTransitionEnabled;

    // Worktree isolation for task execution
    private String worktreePath;
    private String branch;

    // Optimistic locking version
    private Long version;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
