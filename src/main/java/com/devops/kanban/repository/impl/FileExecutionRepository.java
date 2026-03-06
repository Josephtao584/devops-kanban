package com.devops.kanban.repository.impl;

import com.devops.kanban.entity.Execution;
import com.devops.kanban.repository.ExecutionRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import org.springframework.stereotype.Repository;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Repository
public class FileExecutionRepository extends AbstractFileRepository<Execution, Long> implements ExecutionRepository {

    public FileExecutionRepository(@org.springframework.beans.factory.annotation.Value("${app.storage.path:./data}") String storagePath) {
        super(storagePath, new TypeReference<List<Execution>>() {}, Execution::getId);
    }

    @Override
    protected Path getFilePath() {
        return dataDir.resolve("executions.json");
    }

    @Override
    public List<Execution> findByTaskId(Long taskId) {
        return readAll().stream()
                .filter(e -> e.getTaskId() != null && e.getTaskId().equals(taskId))
                .collect(Collectors.toList());
    }

    /**
     * Finds all executions for the given task IDs.
     *
     * @param taskIds the list of task IDs to search for
     * @return list of executions belonging to any of the specified tasks
     */
    @Override
    public List<Execution> findByTaskIds(List<Long> taskIds) {
        if (taskIds == null || taskIds.isEmpty()) {
            return new ArrayList<>();
        }
        return readAll().stream()
                .filter(e -> e.getTaskId() != null && taskIds.contains(e.getTaskId()))
                .collect(Collectors.toList());
    }

    @Override
    public Optional<Execution> findById(Long id) {
        return findByIdGeneric(id);
    }

    @Override
    public Execution save(Execution execution) {
        return saveGeneric(execution, (e, id) -> {
            if (e.getId() == null) {
                e.setId(id);
            }
        });
    }

    /**
     * Deletes all executions for the given task IDs.
     * This is used for cascade deletion when tasks are deleted.
     *
     * @param taskIds the list of task IDs whose executions should be deleted
     */
    @Override
    public void deleteByTaskIds(List<Long> taskIds) {
        if (taskIds == null || taskIds.isEmpty()) {
            return;
        }
        List<Execution> remaining = readAll().stream()
                .filter(e -> e.getTaskId() == null || !taskIds.contains(e.getTaskId()))
                .collect(Collectors.toList());
        writeAll(remaining);
    }
}