package com.devops.kanban.service;

import com.devops.kanban.entity.Session;
import com.devops.kanban.repository.SessionRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Manages heartbeat monitoring for active sessions.
 * Extracted from SessionService to improve separation of concerns.
 */
@Service
@Slf4j
public class HeartbeatMonitor {

    private final SessionRepository sessionRepository;
    private final ClaudeCodeExecutor claudeCodeExecutor;
    private final ConcurrentHashMap<Long, Thread> activeMonitors = new ConcurrentHashMap<>();

    public HeartbeatMonitor(SessionRepository sessionRepository, ClaudeCodeExecutor claudeCodeExecutor) {
        this.sessionRepository = sessionRepository;
        this.claudeCodeExecutor = claudeCodeExecutor;
    }

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

            while (claudeCodeExecutor.isAlive(sessionId)) {
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
        int exitCode = claudeCodeExecutor.getExitCode(sessionId);
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
        });
    }
}