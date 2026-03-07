package com.devops.kanban.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Backward-compatible wrapper for SessionBroadcaster.
 *
 * @deprecated Use {@link com.devops.kanban.infrastructure.websocket.SessionBroadcaster} instead.
 */
@Service
@Deprecated
public class SessionBroadcaster {

    private final com.devops.kanban.infrastructure.websocket.SessionBroadcaster delegate;

    @Autowired
    public SessionBroadcaster(com.devops.kanban.infrastructure.websocket.SessionBroadcaster delegate) {
        this.delegate = delegate;
    }

    public void broadcastChunk(Long sessionId, String stream, String content, boolean isComplete) {
        delegate.broadcastChunk(sessionId, stream, content, isComplete);
    }

    public void broadcastStatus(Long sessionId, String status) {
        delegate.broadcastStatus(sessionId, status);
    }

    public void broadcastExit(Long sessionId, int exitCode, String status, long durationMs) {
        delegate.broadcastExit(sessionId, exitCode, status, durationMs);
    }

    public void broadcastClaudeSessionId(Long sessionId, String claudeSessionId) {
        delegate.broadcastClaudeSessionId(sessionId, claudeSessionId);
    }
}
