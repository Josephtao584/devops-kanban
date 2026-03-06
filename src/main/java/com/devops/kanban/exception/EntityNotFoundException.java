package com.devops.kanban.exception;

/**
 * Exception thrown when an entity is not found.
 * Results in HTTP 404 response.
 */
public class EntityNotFoundException extends RuntimeException {

    private final String entityType;
    private final Object identifier;

    public EntityNotFoundException(String entityType, Object identifier) {
        super(String.format("%s not found: %s", entityType, identifier));
        this.entityType = entityType;
        this.identifier = identifier;
    }

    public EntityNotFoundException(String message) {
        super(message);
        this.entityType = null;
        this.identifier = null;
    }

    public String getEntityType() {
        return entityType;
    }

    public Object getIdentifier() {
        return identifier;
    }
}