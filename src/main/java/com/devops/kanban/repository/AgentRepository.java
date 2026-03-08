package com.devops.kanban.repository;

import com.devops.kanban.entity.Agent;
import java.util.List;
import java.util.Optional;

public interface AgentRepository {
    List<Agent> findAll();
    List<Agent> findByProjectId(Long projectId);
    Optional<Agent> findById(Long id);
    Agent save(Agent agent);
    void deleteById(Long id);
    void deleteByProjectId(Long projectId);
    Long getNextId();
}
