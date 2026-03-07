package com.devops.kanban.infrastructure.websocket;

import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * Handles WebSocket broadcasting for session output and status.
 * Provides centralized message broadcasting for AI agent sessions.
 */
@Component
@Slf4j
public class SessionBroadcaster {

    private final SimpMessagingTemplate messagingTemplate;

    public SessionBroadcaster(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Broadcast a chunk of output to session subscribers.
     *
     * @param sessionId the session ID
     * @param stream the stream type (stdout/stderr)
     * @param content the content to broadcast
     * @param isComplete whether this is the final chunk
     */
    public void broadcastChunk(Long sessionId, String stream, String content, boolean isComplete) {
        String role = "stdin".equals(stream) ? "user" : "assistant";

        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "chunk");
        payload.put("stream", stream);
        payload.put("role", role);
        payload.put("content", content);
        payload.put("isComplete", isComplete);
        payload.put("timestamp", System.currentTimeMillis());

        messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/output", payload);
        log.debug("[Broadcast] Session {} sent {} chars (stream={})", sessionId, content.length(), stream);
    }

    /**
     * Broadcast status update to session subscribers.
     *
     * @param sessionId the session ID
     * @param status the status to broadcast
     */
    public void broadcastStatus(Long sessionId, String status) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "status");
        payload.put("status", status);
        payload.put("sessionId", sessionId);
        payload.put("timestamp", System.currentTimeMillis());

        messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/status", payload);
        log.info("[Broadcast] Session {} status: {}", sessionId, status);
    }

    /**
     * Broadcast process exit event to session subscribers.
     *
     * @param sessionId the session ID
     * @param exitCode the process exit code
     * @param status the final status
     * @param durationMs the process duration in milliseconds
     */
    public void broadcastExit(Long sessionId, int exitCode, String status, long durationMs) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "exit");
        payload.put("exitCode", exitCode);
        payload.put("status", status);
        payload.put("durationMs", durationMs);
        payload.put("timestamp", System.currentTimeMillis());

        messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/status", payload);
        log.info("[Broadcast] Session {} exit: code={}, status={}, duration={}ms",
            sessionId, exitCode, status, durationMs);
    }

    /**
     * Broadcast Claude session ID update to session subscribers.
     *
     * @param sessionId the session ID
     * @param claudeSessionId the Claude CLI native session ID
     */
    public void broadcastClaudeSessionId(Long sessionId, String claudeSessionId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "claude_session_id");
        payload.put("claudeSessionId", claudeSessionId);
        payload.put("timestamp", System.currentTimeMillis());

        messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/status", payload);
        log.info("[Broadcast] Session {} Claude session ID: {}", sessionId, claudeSessionId);
    }
}
