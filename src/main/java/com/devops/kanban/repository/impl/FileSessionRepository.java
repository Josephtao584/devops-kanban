package com.devops.kanban.repository.impl;

import com.devops.kanban.entity.Session;
import com.devops.kanban.repository.SessionRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import org.springframework.stereotype.Repository;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Repository
public class FileSessionRepository extends AbstractFileRepository<Session, Long> implements SessionRepository {

    public FileSessionRepository(@org.springframework.beans.factory.annotation.Value("${app.storage.path:./data}") String storagePath) {
        super(storagePath, new TypeReference<List<Session>>() {}, Session::getId);
    }

    @Override
    protected Path getFilePath() {
        return dataDir.resolve("sessions.json");
    }

    @Override
    public List<Session> findByTaskId(Long taskId) {
        return readAll().stream()
                .filter(s -> s.getTaskId() != null && s.getTaskId().equals(taskId))
                .collect(Collectors.toList());
    }

    /**
     * Finds all sessions for the given task IDs.
     *
     * @param taskIds the list of task IDs to search for
     * @return list of sessions belonging to any of the specified tasks
     */
    @Override
    public List<Session> findByTaskIds(List<Long> taskIds) {
        if (taskIds == null || taskIds.isEmpty()) {
            return new ArrayList<>();
        }
        return readAll().stream()
                .filter(s -> s.getTaskId() != null && taskIds.contains(s.getTaskId()))
                .collect(Collectors.toList());
    }

    @Override
    public Optional<Session> findActiveByTaskId(Long taskId) {
        return readAll().stream()
                .filter(s -> s.getTaskId() != null && s.getTaskId().equals(taskId))
                .filter(s -> s.getStatus() == Session.SessionStatus.CREATED ||
                             s.getStatus() == Session.SessionStatus.RUNNING ||
                             s.getStatus() == Session.SessionStatus.IDLE)
                .findFirst();
    }

    @Override
    public Optional<Session> findById(Long id) {
        return findByIdGeneric(id);
    }

    @Override
    public Optional<Session> findBySessionId(String sessionId) {
        return readAll().stream()
                .filter(s -> sessionId != null && sessionId.equals(s.getSessionId()))
                .findFirst();
    }

    @Override
    public Session save(Session session) {
        return saveGeneric(session, (s, id) -> {
            if (s.getId() == null) {
                s.setId(id);
            }
        });
    }

    @Override
    public void delete(Long id) {
        deleteByIdGeneric(id);
    }

    /**
     * Deletes all sessions for the given task IDs.
     * This is used for cascade deletion when tasks are deleted.
     *
     * @param taskIds the list of task IDs whose sessions should be deleted
     */
    @Override
    public void deleteByTaskIds(List<Long> taskIds) {
        if (taskIds == null || taskIds.isEmpty()) {
            return;
        }
        List<Session> remaining = readAll().stream()
                .filter(s -> s.getTaskId() == null || !taskIds.contains(s.getTaskId()))
                .collect(Collectors.toList());
        writeAll(remaining);
    }
}