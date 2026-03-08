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

    /**
     * Broadcast message_start event to clear frontend streaming state.
     * Called when a new message begins in multi-turn conversations.
     *
     * @param sessionId the session ID
     */
    public void broadcastMessageStart(Long sessionId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "message_start");
        payload.put("timestamp", System.currentTimeMillis());
        messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/output", payload);
        log.debug("[Broadcast] Session {} message started", sessionId);
    }

    /**
     * Broadcast a streaming chunk with content type differentiation.
     * Used for real-time streaming output with thinking vs text content.
     *
     * @param sessionId the session ID
     * @param contentType the content type ("thinking" or "text")
     * @param content the content to broadcast
     * @param blockIndex the content block index for message grouping
     */
    public void broadcastStreamingChunk(Long sessionId, String contentType, String content, int blockIndex) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "chunk");
        payload.put("contentType", contentType);
        payload.put("content", content);
        payload.put("blockIndex", blockIndex);
        payload.put("timestamp", System.currentTimeMillis());

        messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/output", payload);
        log.debug("[Broadcast] Session {} streaming {} chars (contentType={}, blockIndex={})",
            sessionId, content.length(), contentType, blockIndex);
    }

    /**
     * Broadcast tool use event when Claude calls a tool.
     *
     * @param sessionId the session ID
     * @param toolCallId the tool call ID
     * @param toolName the tool name (Bash, Read, Edit, etc.)
     * @param toolInput the tool input parameters
     * @param blockIndex the content block index
     */
    public void broadcastToolUse(Long sessionId, String toolCallId, String toolName,
                                  Map<String, Object> toolInput, int blockIndex) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "tool_use");
        payload.put("toolCallId", toolCallId);
        payload.put("toolName", toolName);
        payload.put("toolInput", toolInput);
        payload.put("blockIndex", blockIndex);
        payload.put("timestamp", System.currentTimeMillis());

        messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/output", payload);
        log.info("[Broadcast] Session {} tool use: {} (id={})", sessionId, toolName, toolCallId);
    }

    /**
     * Broadcast tool result event when tool execution completes.
     *
     * @param sessionId the session ID
     * @param toolUseId the tool use ID (matches toolCallId)
     * @param content the tool execution result content
     * @param isError whether the tool execution failed
     */
    public void broadcastToolResult(Long sessionId, String toolUseId, String content, boolean isError) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "tool_result");
        payload.put("toolUseId", toolUseId);
        payload.put("content", content);
        payload.put("isError", isError);
        payload.put("timestamp", System.currentTimeMillis());

        messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/output", payload);
        log.info("[Broadcast] Session {} tool result: {} (error={})", sessionId, toolUseId, isError);
    }

    /**
     * Broadcast permission denial event when a tool call is denied.
     *
     * @param sessionId the session ID
     * @param resource the denied resource
     * @param reason the denial reason
     */
    public void broadcastPermissionDenial(Long sessionId, String resource, String reason) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "permission_denial");
        payload.put("resource", resource);
        payload.put("reason", reason);
        payload.put("timestamp", System.currentTimeMillis());

        messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/output", payload);
        log.info("[Broadcast] Session {} permission denied: {} - {}", sessionId, resource, reason);
    }
}
