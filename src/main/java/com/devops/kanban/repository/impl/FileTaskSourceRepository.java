package com.devops.kanban.repository.impl;

import com.devops.kanban.entity.TaskSource;
import com.devops.kanban.repository.TaskSourceRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import org.springframework.stereotype.Repository;

import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Repository
public class FileTaskSourceRepository extends AbstractFileRepository<TaskSource, Long> implements TaskSourceRepository {

    public FileTaskSourceRepository(@org.springframework.beans.factory.annotation.Value("${app.storage.path:./data}") String storagePath) {
        super(storagePath, new TypeReference<List<TaskSource>>() {}, TaskSource::getId);
    }

    @Override
    protected Path getFilePath() {
        return dataDir.resolve("task_sources.json");
    }

    @Override
    public List<TaskSource> findByProjectId(Long projectId) {
        return readAll().stream()
                .filter(s -> s.getProjectId() != null && s.getProjectId().equals(projectId))
                .collect(Collectors.toList());
    }

    @Override
    public Optional<TaskSource> findById(Long id) {
        return findByIdGeneric(id);
    }

    @Override
    public TaskSource save(TaskSource source) {
        return saveGeneric(source, (s, id) -> {
            if (s.getId() == null) {
                s.setId(id);
                s.setCreatedAt(LocalDateTime.now());
            }
        });
    }

    @Override
    public void deleteById(Long id) {
        deleteByIdGeneric(id);
    }

    /**
     * Deletes all task sources for a given project.
     * This is used for cascade deletion when a project is deleted.
     *
     * @param projectId the ID of the project whose task sources should be deleted
     */
    @Override
    public void deleteByProjectId(Long projectId) {
        List<TaskSource> sources = readAll().stream()
                .filter(s -> s.getProjectId() == null || !s.getProjectId().equals(projectId))
                .collect(Collectors.toList());
        writeAll(sources);
    }
}