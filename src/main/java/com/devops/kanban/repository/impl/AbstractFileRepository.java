package com.devops.kanban.repository.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.beans.factory.annotation.Value;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Function;

/**
 * Abstract base class for file-based repositories.
 * Provides common CRUD operations and ID generation for entities stored in JSON files.
 *
 * @param <T> the entity type
 * @param <ID> the ID type (typically Long)
 */
public abstract class AbstractFileRepository<T, ID> {

    protected final Path dataDir;
    protected final ObjectMapper mapper;
    protected final AtomicLong idGenerator = new AtomicLong(0);
    protected final TypeReference<List<T>> typeReference;
    protected final Function<T, ID> idExtractor;
    // Lock object for thread-safe file operations
    protected final Object fileLock = new Object();

    /**
     * Constructs a new AbstractFileRepository.
     *
     * @param storagePath the base storage path from configuration
     * @param typeReference the TypeReference for deserializing lists of entities
     * @param idExtractor function to extract ID from an entity
     */
    protected AbstractFileRepository(
            @Value("${app.storage.path:./data}") String storagePath,
            TypeReference<List<T>> typeReference,
            Function<T, ID> idExtractor) {
        this.dataDir = Paths.get(storagePath);
        this.typeReference = typeReference;
        this.idExtractor = idExtractor;
        this.mapper = new ObjectMapper()
                .registerModule(new JavaTimeModule());
        loadIdGenerator();
    }

    /**
     * Gets the file path for this repository's data file.
     * Override this method if the file path needs to be dynamic.
     *
     * @return the path to the JSON file
     */
    protected abstract Path getFilePath();

    /**
     * Reads all entities from the data file.
     *
     * @return list of all entities, or empty list if file doesn't exist or on error
     */
    protected List<T> readAll() {
        try {
            File file = getFilePath().toFile();
            if (!file.exists()) {
                return new ArrayList<>();
            }
            return mapper.readValue(file, typeReference);
        } catch (IOException e) {
            return new ArrayList<>();
        }
    }

    /**
     * Writes all entities to the data file with atomic write semantics.
     * Uses temp file + atomic rename to prevent data corruption.
     * Thread-safe: uses file-level locking to prevent concurrent writes.
     *
     * @param entities the list of entities to write
     * @throws RuntimeException if write fails
     */
    protected void writeAll(List<T> entities) {
        synchronized (fileLock) {
            try {
                Files.createDirectories(dataDir);
                Path targetPath = getFilePath();
                Path tempPath = targetPath.resolveSibling(targetPath.getFileName() + ".tmp");

                // Write to temp file first
                mapper.writerWithDefaultPrettyPrinter().writeValue(tempPath.toFile(), entities);

                // Atomic rename (on most filesystems)
                Files.move(tempPath, targetPath, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } catch (IOException e) {
                throw new RuntimeException("Failed to write data to file: " + getFilePath(), e);
            }
        }
    }

    /**
     * Loads the ID generator with the maximum ID found in existing data.
     */
    protected void loadIdGenerator() {
        List<T> entities = readAll();
        long maxId = entities.stream()
                .mapToLong(e -> {
                    ID id = idExtractor.apply(e);
                    if (id instanceof Long) {
                        return (Long) id;
                    }
                    return 0L;
                })
                .max()
                .orElse(0);
        idGenerator.set(maxId);
    }

    /**
     * Generates the next unique ID.
     *
     * @return the next ID
     */
    public Long getNextId() {
        return idGenerator.incrementAndGet();
    }

    /**
     * Finds an entity by its ID.
     *
     * @param id the ID to search for
     * @return Optional containing the entity if found
     */
    protected Optional<T> findByIdGeneric(ID id) {
        return readAll().stream()
                .filter(e -> {
                    ID entityId = idExtractor.apply(e);
                    return entityId != null && entityId.equals(id);
                })
                .findFirst();
    }

    /**
     * Saves an entity. If the entity has no ID, a new ID is generated.
     *
     * @param entity the entity to save
     * @param idSetter function to set ID on the entity
     * @return the saved entity
     */
    @FunctionalInterface
    public interface IdSetter<T> {
        void set(T entity, Long id);
    }

    protected T saveGeneric(T entity, IdSetter<T> idSetter) {
        List<T> entities = new ArrayList<>(readAll());

        ID existingId = idExtractor.apply(entity);
        if (existingId == null) {
            Long newId = getNextId();
            idSetter.set(entity, newId);
        }

        // Remove existing entity with same ID
        entities.removeIf(e -> {
            ID entityId = idExtractor.apply(e);
            ID newEntityId = idExtractor.apply(entity);
            return entityId != null && entityId.equals(newEntityId);
        });
        entities.add(entity);

        writeAll(entities);
        return entity;
    }

    /**
     * Deletes an entity by its ID.
     *
     * @param id the ID of the entity to delete
     */
    protected void deleteByIdGeneric(ID id) {
        List<T> entities = new ArrayList<>(readAll());
        entities.removeIf(e -> {
            ID entityId = idExtractor.apply(e);
            return entityId != null && entityId.equals(id);
        });
        writeAll(entities);
    }
}