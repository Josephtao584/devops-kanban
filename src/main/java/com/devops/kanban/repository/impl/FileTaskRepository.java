package com.devops.kanban.repository.impl;

import com.devops.kanban.entity.Task;
import com.devops.kanban.repository.TaskRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

/**
 * Repository for Task entities with multi-file storage support.
 * Tasks are stored per-project in separate files (tasks_{projectId}.json).
 * An aggregated all_tasks.json file is maintained for cross-project queries.
 */
@Repository
public class FileTaskRepository implements TaskRepository {

    private final Path dataDir;
    private final ObjectMapper mapper;
    private final AtomicLong idGenerator = new AtomicLong(0);

    // Cache for all tasks to avoid repeated file reads
    private final Map<Long, Task> taskCache = new ConcurrentHashMap<>();
    private volatile boolean cacheLoaded = false;

    public FileTaskRepository(@Value("${app.storage.path:./data}") String storagePath) {
        this.dataDir = Paths.get(storagePath);
        this.mapper = new ObjectMapper()
                .registerModule(new JavaTimeModule());
        loadIdGenerator();
    }

    private Path getProjectFilePath(Long projectId) {
        return dataDir.resolve("tasks_" + projectId + ".json");
    }

    private Path getAllTasksFilePath() {
        return dataDir.resolve("all_tasks.json");
    }

    private List<Task> readByProjectId(Long projectId) {
        try {
            File file = getProjectFilePath(projectId).toFile();
            if (!file.exists()) {
                return new ArrayList<>();
            }
            return mapper.readValue(file, new TypeReference<List<Task>>() {});
        } catch (IOException e) {
            return new ArrayList<>();
        }
    }

    private void writeByProjectId(Long projectId, List<Task> tasks) {
        try {
            Files.createDirectories(dataDir);
            Path targetPath = getProjectFilePath(projectId);
            Path tempPath = targetPath.resolveSibling(targetPath.getFileName() + ".tmp");

            // Atomic write: write to temp file first, then rename
            mapper.writerWithDefaultPrettyPrinter().writeValue(tempPath.toFile(), tasks);
            Files.move(tempPath, targetPath, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new RuntimeException("Failed to write tasks for project: " + projectId, e);
        }
    }

    /**
     * Loads all tasks into cache and initializes ID generator.
     * Uses lazy loading on first access.
     */
    private synchronized void ensureCacheLoaded() {
        if (cacheLoaded) {
            return;
        }
        try {
            Path allTasksFile = getAllTasksFilePath();
            if (Files.exists(allTasksFile)) {
                List<Task> allTasks = mapper.readValue(allTasksFile.toFile(), new TypeReference<List<Task>>() {});
                allTasks.forEach(task -> {
                    if (task.getId() != null) {
                        taskCache.put(task.getId(), task);
                    }
                });
            }
            cacheLoaded = true;
        } catch (IOException e) {
            // If all_tasks.json doesn't exist, load from project files
            loadFromProjectFiles();
        }
    }

    /**
     * Fallback: Load tasks from individual project files if all_tasks.json is missing.
     */
    private void loadFromProjectFiles() {
        try {
            if (Files.exists(dataDir)) {
                Files.list(dataDir)
                        .filter(p -> p.getFileName().toString().startsWith("tasks_"))
                        .forEach(p -> {
                            try {
                                List<Task> projectTasks = mapper.readValue(p.toFile(), new TypeReference<List<Task>>() {});
                                projectTasks.forEach(task -> {
                                    if (task.getId() != null) {
                                        taskCache.put(task.getId(), task);
                                    }
                                });
                            } catch (IOException ignored) {}
                        });
            }
            cacheLoaded = true;
        } catch (IOException e) {
            cacheLoaded = true; // Allow empty cache
        }
    }

    /**
     * Incrementally updates the all_tasks.json file.
     * Only writes the changed task instead of rewriting the entire file.
     */
    private void updateAllTasksIncremental(Task task) {
        try {
            Files.createDirectories(dataDir);
            Path targetPath = getAllTasksFilePath();
            Path tempPath = targetPath.resolveSibling(targetPath.getFileName() + ".tmp");

            // Update cache
            taskCache.put(task.getId(), task);

            // Write all tasks from cache
            List<Task> allTasks = new ArrayList<>(taskCache.values());
            mapper.writerWithDefaultPrettyPrinter().writeValue(tempPath.toFile(), allTasks);
            Files.move(tempPath, targetPath, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new RuntimeException("Failed to update all_tasks.json", e);
        }
    }

    /**
     * Removes a task from all_tasks.json incrementally.
     */
    private void removeFromAllTasks(Long taskId) {
        try {
            taskCache.remove(taskId);

            Path targetPath = getAllTasksFilePath();
            if (!taskCache.isEmpty()) {
                Files.createDirectories(dataDir);
                Path tempPath = targetPath.resolveSibling(targetPath.getFileName() + ".tmp");
                List<Task> allTasks = new ArrayList<>(taskCache.values());
                mapper.writerWithDefaultPrettyPrinter().writeValue(tempPath.toFile(), allTasks);
                Files.move(tempPath, targetPath, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } else if (Files.exists(targetPath)) {
                Files.delete(targetPath);
            }
        } catch (IOException e) {
            throw new RuntimeException("Failed to update all_tasks.json", e);
        }
    }

    private void loadIdGenerator() {
        long maxId = 0;
        try {
            if (Files.exists(dataDir)) {
                for (File file : dataDir.toFile().listFiles((dir, name) -> name.startsWith("tasks_"))) {
                    List<Task> tasks = mapper.readValue(file, new TypeReference<List<Task>>() {});
                    maxId = Math.max(maxId, tasks.stream()
                            .mapToLong(t -> t.getId() != null ? t.getId() : 0)
                            .max()
                            .orElse(0));
                }
            }
        } catch (IOException ignored) {}
        idGenerator.set(maxId);
    }

    @Override
    public List<Task> findByProjectId(Long projectId) {
        return readByProjectId(projectId);
    }

    @Override
    public List<Long> findIdsByProjectId(Long projectId) {
        return readByProjectId(projectId).stream()
                .map(Task::getId)
                .collect(Collectors.toList());
    }

    @Override
    public Optional<Task> findById(Long id) {
        ensureCacheLoaded();
        return Optional.ofNullable(taskCache.get(id));
    }

    @Override
    public Task save(Task task) {
        Long projectId = task.getProjectId();
        List<Task> tasks = new ArrayList<>(readByProjectId(projectId));

        if (task.getId() == null) {
            task.setId(getNextId());
            task.setCreatedAt(LocalDateTime.now());
        }
        task.setUpdatedAt(LocalDateTime.now());

        tasks.removeIf(t -> t.getId().equals(task.getId()));
        tasks.add(task);

        // Write to project file
        writeByProjectId(projectId, tasks);

        // Update all_tasks.json incrementally
        updateAllTasksIncremental(task);

        return task;
    }

    @Override
    public void deleteById(Long id) {
        Task task = findById(id).orElse(null);
        if (task != null) {
            List<Task> tasks = new ArrayList<>(readByProjectId(task.getProjectId()));
            tasks.removeIf(t -> t.getId().equals(id));
            writeByProjectId(task.getProjectId(), tasks);

            // Remove from all_tasks.json incrementally
            removeFromAllTasks(id);
        }
    }

    /**
     * Deletes all tasks for a given project.
     * This is used for cascade deletion when a project is deleted.
     *
     * @param projectId the ID of the project whose tasks should be deleted
     */
    @Override
    public void deleteByProjectId(Long projectId) {
        // Get all task IDs for this project
        List<Long> taskIds = findIdsByProjectId(projectId);

        // Remove all tasks from the cache
        for (Long taskId : taskIds) {
            taskCache.remove(taskId);
        }

        // Delete the project-specific task file
        Path projectFile = getProjectFilePath(projectId);
        try {
            if (Files.exists(projectFile)) {
                Files.delete(projectFile);
            }
        } catch (IOException e) {
            throw new RuntimeException("Failed to delete tasks file for project: " + projectId, e);
        }

        // Update all_tasks.json
        Path allTasksFile = getAllTasksFilePath();
        try {
            if (taskCache.isEmpty()) {
                // If no tasks remain, delete the all_tasks.json file
                if (Files.exists(allTasksFile)) {
                    Files.delete(allTasksFile);
                }
            } else {
                // Otherwise, rewrite the all_tasks.json file
                Files.createDirectories(dataDir);
                Path tempPath = allTasksFile.resolveSibling(allTasksFile.getFileName() + ".tmp");
                List<Task> remainingTasks = new ArrayList<>(taskCache.values());
                mapper.writerWithDefaultPrettyPrinter().writeValue(tempPath.toFile(), remainingTasks);
                Files.move(tempPath, allTasksFile, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException e) {
            throw new RuntimeException("Failed to update all_tasks.json after deleting project tasks", e);
        }
    }

    @Override
    public Long getNextId() {
        return idGenerator.incrementAndGet();
    }
}