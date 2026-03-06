package com.devops.kanban.service;

import com.devops.kanban.dto.TaskDTO;
import com.devops.kanban.entity.Task;
import com.devops.kanban.entity.TaskSource;
import com.devops.kanban.exception.EntityNotFoundException;
import com.devops.kanban.repository.TaskRepository;
import com.devops.kanban.repository.TaskSourceRepository;
import com.devops.kanban.spi.TaskSourceAdapter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Manages task sources and synchronizes tasks from external sources.
 * Refactored to use AdapterRegistry.
 */
@Service
@Slf4j
public class TaskSourceManager {

    private final TaskSourceRepository taskSourceRepository;
    private final TaskRepository taskRepository;
    private final AdapterRegistry adapterRegistry;

    public TaskSourceManager(
            TaskSourceRepository taskSourceRepository,
            TaskRepository taskRepository,
            AdapterRegistry adapterRegistry) {
        this.taskSourceRepository = taskSourceRepository;
        this.taskRepository = taskRepository;
        this.adapterRegistry = adapterRegistry;
    }

    /**
     * Sync all tasks from a specific task source
     */
    public int syncTasks(Long sourceId) {
        TaskSource source = taskSourceRepository.findById(sourceId)
                .orElseThrow(() -> new EntityNotFoundException("TaskSource", sourceId));

        if (!source.isEnabled()) {
            log.info("Task source {} is disabled, skipping sync", sourceId);
            return 0;
        }

        TaskSourceAdapter adapter = adapterRegistry.getSourceAdapter(source.getType());
        List<TaskDTO> externalTasks = adapter.fetchTasks(source);

        int syncedCount = 0;
        for (TaskDTO dto : externalTasks) {
            Optional<Task> existingTask = taskRepository.findByProjectId(source.getProjectId()).stream()
                    .filter(t -> dto.getExternalId() != null && dto.getExternalId().equals(t.getExternalId()))
                    .findFirst();

            Task task;
            if (existingTask.isPresent()) {
                task = existingTask.get();
                task.setTitle(dto.getTitle());
                task.setDescription(dto.getDescription());
                task.setStatus(Task.TaskStatus.valueOf(dto.getStatus()));
                task.setSyncedAt(LocalDateTime.now());
            } else {
                task = Task.builder()
                        .projectId(source.getProjectId())
                        .sourceId(source.getId())
                        .externalId(dto.getExternalId())
                        .title(dto.getTitle())
                        .description(dto.getDescription())
                        .status(Task.TaskStatus.valueOf(dto.getStatus()))
                        .priority(Task.TaskPriority.MEDIUM)
                        .syncedAt(LocalDateTime.now())
                        .build();
            }

            taskRepository.save(task);
            syncedCount++;
        }

        source.setLastSyncAt(LocalDateTime.now());
        taskSourceRepository.save(source);

        log.info("Synced {} tasks from source {}", syncedCount, sourceId);
        return syncedCount;
    }

    /**
     * Test connection to a task source
     */
    public boolean testConnection(Long sourceId) {
        TaskSource source = taskSourceRepository.findById(sourceId)
                .orElseThrow(() -> new EntityNotFoundException("TaskSource", sourceId));

        TaskSourceAdapter adapter = adapterRegistry.getSourceAdapter(source.getType());
        return adapter.testConnection(source);
    }

    /**
     * Validate task source configuration
     */
    public boolean validateConfig(TaskSource.TaskSourceType type, String config) {
        TaskSourceAdapter adapter = adapterRegistry.getSourceAdapter(type);
        return adapter.validateConfig(config);
    }

    /**
     * Get all task sources for a project
     */
    public List<TaskSource> getSourcesByProjectId(Long projectId) {
        return taskSourceRepository.findByProjectId(projectId);
    }

    /**
     * Create a new task source
     */
    public TaskSource createSource(TaskSource source) {
        if (!validateConfig(source.getType(), source.getConfig())) {
            throw new IllegalArgumentException("Invalid configuration for task source type: " + source.getType());
        }
        return taskSourceRepository.save(source);
    }

    /**
     * Delete a task source
     */
    public void deleteSource(Long id) {
        taskSourceRepository.deleteById(id);
    }
}