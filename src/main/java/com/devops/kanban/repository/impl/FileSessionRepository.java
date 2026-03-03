package com.devops.kanban.repository.impl;

import com.devops.kanban.entity.Session;
import com.devops.kanban.repository.SessionRepository;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

@Repository
public class FileSessionRepository implements SessionRepository {

    private final Path dataDir;
    private final ObjectMapper mapper;
    private final AtomicLong idGenerator = new AtomicLong(0);

    public FileSessionRepository(@Value("${app.storage.path:./data}") String storagePath) {
        this.dataDir = Paths.get(storagePath);
        this.mapper = new ObjectMapper()
                .registerModule(new JavaTimeModule());
        loadIdGenerator();
    }

    private Path getFilePath() {
        return dataDir.resolve("sessions.json");
    }

    private List<Session> readAll() {
        try {
            File file = getFilePath().toFile();
            if (!file.exists()) {
                return new ArrayList<>();
            }
            return mapper.readValue(file, new TypeReference<List<Session>>() {});
        } catch (IOException e) {
            return new ArrayList<>();
        }
    }

    private void writeAll(List<Session> sessions) {
        try {
            Files.createDirectories(dataDir);
            mapper.writerWithDefaultPrettyPrinter().writeValue(getFilePath().toFile(), sessions);
        } catch (IOException e) {
            throw new RuntimeException("Failed to write sessions", e);
        }
    }

    private void loadIdGenerator() {
        List<Session> sessions = readAll();
        long maxId = sessions.stream()
                .mapToLong(s -> s.getId() != null ? s.getId() : 0)
                .max()
                .orElse(0);
        idGenerator.set(maxId);
    }

    @Override
    public List<Session> findByTaskId(Long taskId) {
        return readAll().stream()
                .filter(s -> s.getTaskId().equals(taskId))
                .collect(Collectors.toList());
    }

    @Override
    public Optional<Session> findActiveByTaskId(Long taskId) {
        return readAll().stream()
                .filter(s -> s.getTaskId().equals(taskId))
                .filter(s -> s.getStatus() == Session.SessionStatus.CREATED ||
                             s.getStatus() == Session.SessionStatus.RUNNING ||
                             s.getStatus() == Session.SessionStatus.IDLE)
                .findFirst();
    }

    @Override
    public Optional<Session> findById(Long id) {
        return readAll().stream()
                .filter(s -> s.getId().equals(id))
                .findFirst();
    }

    @Override
    public Optional<Session> findBySessionId(String sessionId) {
        return readAll().stream()
                .filter(s -> sessionId.equals(s.getSessionId()))
                .findFirst();
    }

    @Override
    public Session save(Session session) {
        List<Session> sessions = new ArrayList<>(readAll());

        if (session.getId() == null) {
            session.setId(getNextId());
        }

        sessions.removeIf(s -> s.getId().equals(session.getId()));
        sessions.add(session);

        writeAll(sessions);
        return session;
    }

    @Override
    public void delete(Long id) {
        List<Session> sessions = new ArrayList<>(readAll());
        sessions.removeIf(s -> s.getId().equals(id));
        writeAll(sessions);
    }

    @Override
    public Long getNextId() {
        return idGenerator.incrementAndGet();
    }
}
