package com.devops.kanban.converter;

import com.devops.kanban.dto.*;
import com.devops.kanban.entity.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import java.util.Collections;
import java.util.List;

/**
 * Centralized converter for entity to DTO transformations.
 * Eliminates duplicate toDTO() methods across services and controllers.
 */
@Component
public class EntityDTOConverter {

    private final ObjectMapper objectMapper = new ObjectMapper();

    // ==================== Task ====================

    public TaskDTO toDTO(Task task) {
        if (task == null) {
            return null;
        }
        return TaskDTO.builder()
                .id(task.getId())
                .projectId(task.getProjectId())
                .title(task.getTitle())
                .description(task.getDescription())
                .status(task.getStatus() != null ? task.getStatus().name() : Task.TaskStatus.TODO.name())
                .priority(task.getPriority() != null ? task.getPriority().name() : Task.TaskPriority.MEDIUM.name())
                .assignee(task.getAssignee())
                .sourceId(task.getSourceId())
                .externalId(task.getExternalId())
                .syncedAt(task.getSyncedAt())
                .autoTransitionEnabled(task.getAutoTransitionEnabled())
                .worktreePath(task.getWorktreePath())
                .branch(task.getBranch())
                .version(task.getVersion())
                .createdAt(task.getCreatedAt())
                .updatedAt(task.getUpdatedAt())
                .build();
    }

    public Task toEntity(TaskDTO dto) {
        if (dto == null) {
            return null;
        }
        return Task.builder()
                .id(dto.getId())
                .projectId(dto.getProjectId())
                .title(dto.getTitle())
                .description(dto.getDescription())
                .status(dto.getStatus() != null ? Task.TaskStatus.valueOf(dto.getStatus()) : Task.TaskStatus.TODO)
                .priority(dto.getPriority() != null ? Task.TaskPriority.valueOf(dto.getPriority()) : Task.TaskPriority.MEDIUM)
                .assignee(dto.getAssignee())
                .sourceId(dto.getSourceId())
                .externalId(dto.getExternalId())
                .syncedAt(dto.getSyncedAt())
                .autoTransitionEnabled(dto.getAutoTransitionEnabled())
                .worktreePath(dto.getWorktreePath())
                .branch(dto.getBranch())
                .version(dto.getVersion())
                .build();
    }

    // ==================== Agent ====================

    public AgentDTO toDTO(Agent agent) {
        if (agent == null) {
            return null;
        }
        return AgentDTO.builder()
                .id(agent.getId())
                .name(agent.getName())
                .type(agent.getType() != null ? agent.getType().name() : Agent.AgentType.CLAUDE.name())
                .enabled(agent.isEnabled())
                .createdAt(agent.getCreatedAt())
                .build();
    }

    public Agent toEntity(AgentDTO dto) {
        if (dto == null) {
            return null;
        }
        return Agent.builder()
                .id(dto.getId())
                .name(dto.getName())
                .type(dto.getType() != null ? Agent.AgentType.valueOf(dto.getType()) : Agent.AgentType.CLAUDE)
                .enabled(dto.isEnabled())
                .build();
    }

    // ==================== Project ====================

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

    public Project toEntity(ProjectDTO dto) {
        if (dto == null) {
            return null;
        }
        return Project.builder()
                .id(dto.getId())
                .name(dto.getName())
                .description(dto.getDescription())
                .repositoryUrl(dto.getRepoUrl())
                .localPath(dto.getLocalPath())
                .build();
    }

    // ==================== TaskSource ====================

    public TaskSourceDTO toDTO(TaskSource taskSource) {
        if (taskSource == null) {
            return null;
        }
        return TaskSourceDTO.builder()
                .id(taskSource.getId())
                .projectId(taskSource.getProjectId())
                .type(taskSource.getType() != null ? taskSource.getType().name() : TaskSource.TaskSourceType.LOCAL.name())
                .name(taskSource.getName())
                .config(taskSource.getConfig())
                .enabled(taskSource.isEnabled())
                .syncInterval(taskSource.getSyncInterval())
                .lastSyncAt(taskSource.getLastSyncAt())
                .createdAt(taskSource.getCreatedAt())
                .build();
    }

    public TaskSource toEntity(TaskSourceDTO dto) {
        if (dto == null) {
            return null;
        }
        return TaskSource.builder()
                .id(dto.getId())
                .projectId(dto.getProjectId())
                .name(dto.getName())
                .type(dto.getType() != null ? TaskSource.TaskSourceType.valueOf(dto.getType()) : TaskSource.TaskSourceType.LOCAL)
                .config(dto.getConfig())
                .enabled(dto.isEnabled())
                .syncInterval(dto.getSyncInterval())
                .build();
    }

    // ==================== Session ====================

    public SessionDTO toDTO(Session session) {
        return toDTO(session, true);
    }

    public SessionDTO toDTO(Session session, boolean includeOutput) {
        if (session == null) {
            return null;
        }
        SessionDTO.SessionDTOBuilder builder = SessionDTO.builder()
                .id(session.getId())
                .taskId(session.getTaskId())
                .agentId(session.getAgentId())
                .status(session.getStatus() != null ? session.getStatus().name() : Session.SessionStatus.CREATED.name())
                .worktreePath(session.getWorktreePath())
                .branch(session.getBranch())
                .sessionId(session.getSessionId())
                .startedAt(session.getStartedAt())
                .lastHeartbeat(session.getLastHeartbeat())
                .stoppedAt(session.getStoppedAt())
                .initialPrompt(session.getInitialPrompt())
                .claudeSessionId(session.getClaudeSessionId());

        if (includeOutput) {
            builder.output(session.getOutput());
        }

        // Parse messages JSON
        if (session.getMessages() != null && !session.getMessages().isEmpty()) {
            try {
                List<ChatMessageDTO> messages = objectMapper.readValue(
                    session.getMessages(),
                    new TypeReference<List<ChatMessageDTO>>() {}
                );
                builder.messages(messages);
            } catch (Exception e) {
                builder.messages(Collections.emptyList());
            }
        }

        return builder.build();
    }

    public Session toEntity(SessionDTO dto) {
        if (dto == null) {
            return null;
        }

        // Serialize messages to JSON
        String messagesJson = null;
        if (dto.getMessages() != null && !dto.getMessages().isEmpty()) {
            try {
                messagesJson = objectMapper.writeValueAsString(dto.getMessages());
            } catch (Exception e) {
                // Ignore serialization errors
            }
        }

        return Session.builder()
                .id(dto.getId())
                .taskId(dto.getTaskId())
                .agentId(dto.getAgentId())
                .status(dto.getStatus() != null ? Session.SessionStatus.valueOf(dto.getStatus()) : Session.SessionStatus.CREATED)
                .worktreePath(dto.getWorktreePath())
                .branch(dto.getBranch())
                .sessionId(dto.getSessionId())
                .startedAt(dto.getStartedAt())
                .lastHeartbeat(dto.getLastHeartbeat())
                .stoppedAt(dto.getStoppedAt())
                .output(dto.getOutput())
                .initialPrompt(dto.getInitialPrompt())
                .claudeSessionId(dto.getClaudeSessionId())
                .messages(messagesJson)
                .build();
    }

    // ==================== Execution ====================

    public ExecutionDTO toDTO(Execution execution) {
        if (execution == null) {
            return null;
        }
        return ExecutionDTO.builder()
                .id(execution.getId())
                .taskId(execution.getTaskId())
                .agentId(execution.getAgentId())
                .status(execution.getStatus() != null ? execution.getStatus().name() : Execution.ExecutionStatus.PENDING.name())
                .worktreePath(execution.getWorktreePath())
                .branch(execution.getBranch())
                .output(execution.getOutput())
                .startedAt(execution.getStartedAt())
                .completedAt(execution.getCompletedAt())
                .build();
    }

    public Execution toEntity(ExecutionDTO dto) {
        if (dto == null) {
            return null;
        }
        return Execution.builder()
                .id(dto.getId())
                .taskId(dto.getTaskId())
                .agentId(dto.getAgentId())
                .status(dto.getStatus() != null ? Execution.ExecutionStatus.valueOf(dto.getStatus()) : Execution.ExecutionStatus.PENDING)
                .worktreePath(dto.getWorktreePath())
                .branch(dto.getBranch())
                .output(dto.getOutput())
                .startedAt(dto.getStartedAt())
                .completedAt(dto.getCompletedAt())
                .build();
    }

    // ==================== PromptTemplate ====================

    public PromptTemplateDTO toDTO(PromptTemplate template) {
        if (template == null) {
            return null;
        }
        return PromptTemplateDTO.builder()
                .id(template.getId())
                .phase(template.getPhase())
                .instruction(template.getInstruction())
                .isDefault(template.isDefault())
                .createdAt(template.getCreatedAt())
                .updatedAt(template.getUpdatedAt())
                .build();
    }

    public PromptTemplate toEntity(PromptTemplateDTO dto) {
        if (dto == null) {
            return null;
        }
        return PromptTemplate.builder()
                .id(dto.getId())
                .phase(dto.getPhase())
                .instruction(dto.getInstruction())
                .isDefault(dto.getIsDefault() != null ? dto.getIsDefault() : false)
                .build();
    }
}