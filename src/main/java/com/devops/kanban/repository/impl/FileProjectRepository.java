package com.devops.kanban.repository.impl;

import com.devops.kanban.entity.Project;
import com.devops.kanban.repository.ProjectRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import org.springframework.stereotype.Repository;

import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public class FileProjectRepository extends AbstractFileRepository<Project, Long> implements ProjectRepository {

    public FileProjectRepository(@org.springframework.beans.factory.annotation.Value("${app.storage.path:./data}") String storagePath) {
        super(storagePath, new TypeReference<List<Project>>() {}, Project::getId);
    }

    @Override
    protected Path getFilePath() {
        return dataDir.resolve("projects.json");
    }

    @Override
    public List<Project> findAll() {
        return readAll();
    }

    @Override
    public Optional<Project> findById(Long id) {
        return findByIdGeneric(id);
    }

    @Override
    public Project save(Project project) {
        return saveGeneric(project, (p, id) -> {
            if (p.getId() == null) {
                p.setId(id);
                p.setCreatedAt(LocalDateTime.now());
            }
            p.setUpdatedAt(LocalDateTime.now());
        });
    }

    @Override
    public void deleteById(Long id) {
        deleteByIdGeneric(id);
    }
}