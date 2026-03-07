package com.devops.kanban.repository.impl;

import com.devops.kanban.entity.PhaseTransitionRule;
import com.devops.kanban.repository.PhaseTransitionRuleRepository;
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
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

/**
 * File-based repository implementation for PhaseTransitionRule entities.
 * Rules are stored in data/phase_transition_rules.json.
 */
@Repository
public class FilePhaseTransitionRuleRepository implements PhaseTransitionRuleRepository {

    private final Path dataDir;
    private final Path filePath;
    private final ObjectMapper mapper;
    private final AtomicLong idGenerator = new AtomicLong(0);
    private final Object fileLock = new Object();

    public FilePhaseTransitionRuleRepository(@Value("${app.storage.path:./data}") String storagePath) {
        this.dataDir = Paths.get(storagePath);
        this.filePath = dataDir.resolve("phase_transition_rules.json");
        this.mapper = new ObjectMapper()
                .registerModule(new JavaTimeModule());
        loadIdGenerator();
    }

    private List<PhaseTransitionRule> readAll() {
        try {
            File file = filePath.toFile();
            if (!file.exists()) {
                return new ArrayList<>();
            }
            return mapper.readValue(file, new TypeReference<List<PhaseTransitionRule>>() {});
        } catch (IOException e) {
            return new ArrayList<>();
        }
    }

    private void writeAll(List<PhaseTransitionRule> rules) {
        synchronized (fileLock) {
            try {
                Files.createDirectories(dataDir);
                Path tempPath = filePath.resolveSibling(filePath.getFileName() + ".tmp");
                mapper.writerWithDefaultPrettyPrinter().writeValue(tempPath.toFile(), rules);
                Files.move(tempPath, filePath, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } catch (IOException e) {
                throw new RuntimeException("Failed to write phase transition rules to file: " + filePath, e);
            }
        }
    }

    private void loadIdGenerator() {
        List<PhaseTransitionRule> rules = readAll();
        long maxId = rules.stream()
                .mapToLong(r -> r.getId() != null ? r.getId() : 0L)
                .max()
                .orElse(0L);
        idGenerator.set(maxId);
    }

    @Override
    public List<PhaseTransitionRule> findAll() {
        return readAll();
    }

    @Override
    public Optional<PhaseTransitionRule> findById(Long id) {
        return readAll().stream()
                .filter(r -> r.getId() != null && r.getId().equals(id))
                .findFirst();
    }

    @Override
    public List<PhaseTransitionRule> findByFromPhaseAndEnabledTrueOrderByPriorityDesc(String fromPhase) {
        return readAll().stream()
                .filter(r -> r.isEnabled() && fromPhase.equals(r.getFromPhase()))
                .sorted(Comparator.comparingInt(PhaseTransitionRule::getPriority).reversed())
                .collect(Collectors.toList());
    }

    @Override
    public List<PhaseTransitionRule> findByEnabledTrueOrderByPriorityDesc() {
        return readAll().stream()
                .filter(PhaseTransitionRule::isEnabled)
                .sorted(Comparator.comparingInt(PhaseTransitionRule::getPriority).reversed())
                .collect(Collectors.toList());
    }

    @Override
    public PhaseTransitionRule save(PhaseTransitionRule rule) {
        List<PhaseTransitionRule> rules = new ArrayList<>(readAll());

        if (rule.getId() == null) {
            rule.setId(getNextId());
        }

        // Remove existing rule with same ID
        rules.removeIf(r -> r.getId() != null && r.getId().equals(rule.getId()));
        rules.add(rule);

        writeAll(rules);
        return rule;
    }

    @Override
    public void deleteById(Long id) {
        List<PhaseTransitionRule> rules = new ArrayList<>(readAll());
        rules.removeIf(r -> r.getId() != null && r.getId().equals(id));
        writeAll(rules);
    }

    @Override
    public void deleteAll() {
        writeAll(new ArrayList<>());
    }

    @Override
    public Long getNextId() {
        return idGenerator.incrementAndGet();
    }

    @Override
    public boolean existsAny() {
        return !readAll().isEmpty();
    }
}
