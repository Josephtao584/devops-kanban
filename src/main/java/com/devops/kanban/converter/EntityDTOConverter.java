package com.devops.kanban.converter;

import com.devops.kanban.dto.AgentDTO;
import com.devops.kanban.dto.ProjectDTO;
import com.devops.kanban.dto.TaskDTO;
import com.devops.kanban.dto.TaskSourceDTO;
import com.devops.kanban.entity.Agent;
import com.devops.kanban.entity.Project;
import com.devops.kanban.entity.Task;
import com.devops.kanban.entity.TaskSource;
import org.springframework.stereotype.Component;

/**
 * Centralized converter for entity to DTO transformations.
 * Eliminates duplicate toDTO() methods across services.
 */
@Component
public class EntityDTOConverter {

    public TaskDTO toDTO(Task task) {
        if (task == null) {
            return null;
        }
        return TaskDTO.builder()
                .id(task.getId())
                .projectId(task.getProjectId())
                .title(task.getTitle())
                .description(task.getDescription())
                .status(task.getStatus() != null ? task.getStatus().name() : null)
                .priority(task.getPriority() != null ? task.getPriority().name() : null)
                .assignee(task.getAssignee())
                .sourceId(task.getSourceId())
                .externalId(task.getExternalId())
                .syncedAt(task.getSyncedAt())
                .createdAt(task.getCreatedAt())
                .updatedAt(task.getUpdatedAt())
                .build();
    }

    public AgentDTO toDTO(Agent agent) {
        if (agent == null) {
            return null;
        }
        return AgentDTO.builder()
                .id(agent.getId())
                .projectId(agent.getProjectId())
                .name(agent.getName())
                .type(agent.getType() != null ? agent.getType().name() : null)
                .config(agent.getConfig())
                .enabled(agent.isEnabled())
                .createdAt(agent.getCreatedAt())
                .build();
    }

    public ProjectDTO toDTO(Project project) {
        if (project == null) {
            return null;
        }
        return ProjectDTO.builder()
                .id(project.getId())
                .name(project.getName())
                .description(project.getDescription())
                .localPath(project.getLocalPath())
                .repoUrl(project.getRepositoryUrl())
                .createdAt(project.getCreatedAt())
                .updatedAt(project.getUpdatedAt())
                .build();
    }

    public TaskSourceDTO toDTO(TaskSource taskSource) {
        if (taskSource == null) {
            return null;
        }
        return TaskSourceDTO.builder()
                .id(taskSource.getId())
                .projectId(taskSource.getProjectId())
                .type(taskSource.getType() != null ? taskSource.getType().name() : null)
                .name(taskSource.getName())
                .config(taskSource.getConfig())
                .enabled(taskSource.isEnabled())
                .lastSyncAt(taskSource.getLastSyncAt())
                .createdAt(taskSource.getCreatedAt())
                .build();
    }
}