package com.devops.kanban.repository;

import com.devops.kanban.entity.Session;
import java.util.List;
import java.util.Optional;

public interface SessionRepository {
    List<Session> findByTaskId(Long taskId);
    List<Session> findByTaskIds(List<Long> taskIds);
    Optional<Session> findActiveByTaskId(Long taskId);
    Optional<Session> findById(Long id);
    Optional<Session> findBySessionId(String sessionId);
    Session save(Session session);
    void delete(Long id);
    void deleteByTaskIds(List<Long> taskIds);
    Long getNextId();
}
