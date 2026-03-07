package com.devops.kanban.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

/**
 * Event published when an AI agent session ends.
 * This allows loose coupling between HeartbeatMonitor and PhaseTransitionService.
 */
@Getter
public class SessionEndedEvent extends ApplicationEvent {

    private final Long sessionId;
    private final int exitCode;
    private final String output;

    public SessionEndedEvent(Object source, Long sessionId, int exitCode, String output) {
        super(source);
        this.sessionId = sessionId;
        this.exitCode = exitCode;
        this.output = output;
    }
}
