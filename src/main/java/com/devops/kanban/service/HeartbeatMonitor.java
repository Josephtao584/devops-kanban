package com.devops.kanban.service;

import com.devops.kanban.entity.Session;
import com.devops.kanban.event.SessionEndedEvent;
import com.devops.kanban.infrastructure.process.ProcessExecutor;
import com.devops.kanban.repository.SessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Manages heartbeat monitoring for active sessions.
 * Extracted from SessionService to improve separation of concerns.
 * Uses event-driven architecture to avoid circular dependencies.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class HeartbeatMonitor {

    private final SessionRepository sessionRepository;
    private final ProcessExecutor processExecutor;
    private final ApplicationEventPublisher eventPublisher;
    private final ConcurrentHashMap<Long, Thread> activeMonitors = new ConcurrentHashMap<>();

    /**
     * Start heartbeat monitoring for a session.
     *
     * @param sessionId the session ID to monitor
     */
    public void startMonitoring(Long sessionId) {
        if (activeMonitors.containsKey(sessionId)) {
            log.debug("[Heartbeat] Monitor already running for session {}", sessionId);
            return;
        }

        log.debug("[Heartbeat] Starting monitor for session {}", sessionId);

        Thread monitorThread = new Thread(() -> {
            Thread.currentThread().setName("session-" + sessionId + "-heartbeat");
            log.debug("[Heartbeat] Monitor started | Thread: {}", Thread.currentThread().getName());

            while (processExecutor.isRunning(sessionId)) {
                try {
                    Thread.sleep(5000); // 5 seconds
                    updateHeartbeat(sessionId);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    log.debug("[Heartbeat] Monitor interrupted for session {}", sessionId);
                    break;
                }
            }

            // Process ended - update status
            handleProcessEnd(sessionId);
            activeMonitors.remove(sessionId);

        }, "session-" + sessionId + "-heartbeat");
        monitorThread.setDaemon(true);
        monitorThread.start();

        activeMonitors.put(sessionId, monitorThread);
    }

    /**
     * Stop heartbeat monitoring for a session.
     *
     * @param sessionId the session ID to stop monitoring
     */
    public void stopMonitoring(Long sessionId) {
        Thread monitor = activeMonitors.remove(sessionId);
        if (monitor != null && monitor.isAlive()) {
            monitor.interrupt();
            log.debug("[Heartbeat] Stopped monitor for session {}", sessionId);
        }
    }

    /**
     * Check if a session has an active monitor.
     *
     * @param sessionId the session ID to check
     * @return true if monitor is active
     */
    public boolean isMonitoring(Long sessionId) {
        Thread monitor = activeMonitors.get(sessionId);
        return monitor != null && monitor.isAlive();
    }

    private void updateHeartbeat(Long sessionId) {
        sessionRepository.findById(sessionId).ifPresent(session -> {
            session.setLastHeartbeat(LocalDateTime.now());
            sessionRepository.save(session);
            log.trace("[Heartbeat] Updated for session {}", sessionId);
        });
    }

    private void handleProcessEnd(Long sessionId) {
        int exitCode = processExecutor.getExitCode(sessionId);
        log.info("[Heartbeat] Process ended for session {} | ExitCode: {}", sessionId, exitCode);

        sessionRepository.findById(sessionId).ifPresent(session -> {
            if (exitCode == 0) {
                session.setStatus(Session.SessionStatus.STOPPED);
            } else {
                session.setStatus(Session.SessionStatus.ERROR);
            }
            session.setStoppedAt(LocalDateTime.now());
            sessionRepository.save(session);
            log.info("[Heartbeat] Final status updated | SessionId: {} | Status: {} | ExitCode: {}",
                sessionId, session.getStatus(), exitCode);

            // Publish event for phase transition analysis (loose coupling)
            try {
                SessionEndedEvent event = new SessionEndedEvent(this, sessionId, exitCode, session.getOutput());
                eventPublisher.publishEvent(event);
                log.debug("[Heartbeat] Published SessionEndedEvent for session {}", sessionId);
            } catch (Exception e) {
                log.error("[Heartbeat] Failed to publish SessionEndedEvent for session {}", sessionId, e);
            }
        });
    }
}
