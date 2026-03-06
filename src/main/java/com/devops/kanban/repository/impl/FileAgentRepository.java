package com.devops.kanban.repository.impl;

import com.devops.kanban.entity.Agent;
import com.devops.kanban.repository.AgentRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import org.springframework.stereotype.Repository;

import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Repository
public class FileAgentRepository extends AbstractFileRepository<Agent, Long> implements AgentRepository {

    public FileAgentRepository(@org.springframework.beans.factory.annotation.Value("${app.storage.path:./data}") String storagePath) {
        super(storagePath, new TypeReference<List<Agent>>() {}, Agent::getId);
    }

    @Override
    protected Path getFilePath() {
        return dataDir.resolve("agents.json");
    }

    @Override
    public List<Agent> findByProjectId(Long projectId) {
        return readAll().stream()
                .filter(a -> a.getProjectId() != null && a.getProjectId().equals(projectId))
                .collect(Collectors.toList());
    }

    @Override
    public Optional<Agent> findById(Long id) {
        return findByIdGeneric(id);
    }

    @Override
    public Agent save(Agent agent) {
        return saveGeneric(agent, (a, id) -> {
            if (a.getId() == null) {
                a.setId(id);
                a.setCreatedAt(LocalDateTime.now());
            }
        });
    }

    @Override
    public void deleteById(Long id) {
        deleteByIdGeneric(id);
    }

    /**
     * Deletes all agents for a given project.
     * This is used for cascade deletion when a project is deleted.
     *
     * @param projectId the ID of the project whose agents should be deleted
     */
    @Override
    public void deleteByProjectId(Long projectId) {
        List<Agent> agents = readAll().stream()
                .filter(a -> a.getProjectId() == null || !a.getProjectId().equals(projectId))
                .collect(Collectors.toList());
        writeAll(agents);
    }
}