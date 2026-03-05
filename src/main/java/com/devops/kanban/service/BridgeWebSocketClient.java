package com.devops.kanban.service;

import com.devops.kanban.config.BridgeConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.java_websocket.client.WebSocketClient;
import org.java_websocket.drafts.Draft_6455;
import org.java_websocket.handshake.ServerHandshake;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;

/**
 * WebSocket client that connects to the Node.js Claude Bridge.
 *
 * Receives real-time output from the bridge and forwards it to frontend
 * via STOMP messaging.
 */
@Service
@Slf4j
public class BridgeWebSocketClient {

    private final BridgeConfig config;
    private final ObjectMapper objectMapper;
    private final SimpMessagingTemplate messagingTemplate;

    // Track active WebSocket connections by bridge session ID
    private final ConcurrentHashMap<String, BridgeWsConnection> activeConnections = new ConcurrentHashMap<>();

    public BridgeWebSocketClient(BridgeConfig config, ObjectMapper objectMapper,
                                   SimpMessagingTemplate messagingTemplate) {
        this.config = config;
        this.objectMapper = objectMapper;
        this.messagingTemplate = messagingTemplate;
        log.info("[BridgeWsClient] Initialized | Bridge URL: {}", config.getWsUrl());
    }

    /**
     * Connect to the Bridge WebSocket for a session and forward output to frontend.
     *
     * @param bridgeSessionId the bridge session ID (UUID)
     * @param dbSessionId    the database session ID (for STOMP topic)
     */
    public void connectToBridge(String bridgeSessionId, Long dbSessionId) {
        String wsUrl = config.getWsUrl() + "?session=" + bridgeSessionId;

        log.info("[BridgeWsClient] Connecting to bridge | SessionId: {} | URL: {}", dbSessionId, wsUrl);

        // Check if already connected
        BridgeWsConnection existing = activeConnections.get(bridgeSessionId);
        if (existing != null && existing.isOpen()) {
            log.info("[BridgeWsClient] Already connected to bridge | SessionId: {}", dbSessionId);
            return;
        }

        try {
            URI uri = URI.create(wsUrl);
            BridgeWsConnection connection = new BridgeWsConnection(
                uri,
                bridgeSessionId,
                dbSessionId,
                messagingTemplate,
                objectMapper
            );

            activeConnections.put(bridgeSessionId, connection);
            connection.connect();

            log.info("[BridgeWsClient] WebSocket connection initiated | SessionId: {}", dbSessionId);

        } catch (Exception e) {
            log.error("[BridgeWsClient] Failed to connect to bridge | SessionId: {} | Error: {}",
                dbSessionId, e.getMessage(), e);
        }
    }

    /**
     * Disconnect from the Bridge WebSocket for a session.
     *
     * @param bridgeSessionId the bridge session ID
     */
    public void disconnectFromBridge(String bridgeSessionId) {
        BridgeWsConnection connection = activeConnections.remove(bridgeSessionId);
        if (connection != null) {
            log.info("[BridgeWsClient] Disconnecting from bridge | SessionId: {}", bridgeSessionId);
            connection.close();
        }
    }

    /**
     * Send input to the bridge via WebSocket.
     *
     * @param bridgeSessionId the bridge session ID
     * @param input          the input to send
     * @return true if sent successfully
     */
    public boolean sendInput(String bridgeSessionId, String input) {
        BridgeWsConnection connection = activeConnections.get(bridgeSessionId);
        if (connection != null && connection.isOpen()) {
            connection.sendInput(input);
            log.debug("[BridgeWsClient] Sent input to bridge | SessionId: {} | Length: {}",
                bridgeSessionId, input.length());
            return true;
        }
        log.warn("[BridgeWsClient] No active connection for session: {}", bridgeSessionId);
        return false;
    }

    /**
     * Check if connected to bridge for a session.
     *
     * @param bridgeSessionId the bridge session ID
     * @return true if connected
     */
    public boolean isConnected(String bridgeSessionId) {
        BridgeWsConnection connection = activeConnections.get(bridgeSessionId);
        return connection != null && connection.isOpen();
    }

    /**
     * Inner class representing a WebSocket connection to the bridge.
     */
    private static class BridgeWsConnection extends WebSocketClient {

        private final String bridgeSessionId;
        private final Long dbSessionId;
        private final SimpMessagingTemplate messagingTemplate;
        private final ObjectMapper objectMapper;

        public BridgeWsConnection(URI serverUri, String bridgeSessionId, Long dbSessionId,
                                   SimpMessagingTemplate messagingTemplate, ObjectMapper objectMapper) {
            super(serverUri, Draft_6455.INSTANCE);
            this.bridgeSessionId = bridgeSessionId;
            this.dbSessionId = dbSessionId;
            this.messagingTemplate = messagingTemplate;
            this.objectMapper = objectMapper;
        }

        @Override
        public void onOpen(ServerHandshake handshake) {
            log.info("[BridgeWsClient] WebSocket connected | SessionId: {} | Handshake: {}",
                dbSessionId, handshake.getHttpStatus());
        }

        @Override
        public void onMessage(String message) {
            log.debug("[BridgeWsClient] Received message | SessionId: {} | Length: {}",
                dbSessionId, message.length());

            try {
                // Parse the JSON message from bridge
                @SuppressWarnings("unchecked")
                Map<String, Object> payload = objectMapper.readValue(message, Map.class);

                String type = (String) payload.get("type");

                // Log message type for debugging
                log.debug("[BridgeWsClient] Message type: {} | SessionId: {}", type, dbSessionId);

                // Forward the message to frontend via STOMP
                String topic = "/topic/session/" + dbSessionId + "/output";
                messagingTemplate.convertAndSend(topic, payload);

                // Also send to status topic for status-type messages
                if ("exit".equals(type) || "error".equals(type) || "status".equals(type)) {
                    String statusTopic = "/topic/session/" + dbSessionId + "/status";
                    messagingTemplate.convertAndSend(statusTopic, payload);
                }

            } catch (Exception e) {
                log.error("[BridgeWsClient] Failed to parse message | SessionId: {} | Error: {}",
                    dbSessionId, e.getMessage());

                // Send raw message as fallback
                Map<String, Object> fallbackPayload = Map.of(
                    "type", "chunk",
                    "stream", "stdout",
                    "role", "assistant",
                    "content", message,
                    "isComplete", true,
                    "timestamp", System.currentTimeMillis()
                );
                messagingTemplate.convertAndSend(
                    "/topic/session/" + dbSessionId + "/output", fallbackPayload);
            }
        }

        @Override
        public void onClose(int code, String reason, boolean remote) {
            log.info("[BridgeWsClient] WebSocket closed | SessionId: {} | Code: {} | Reason: {} | Remote: {}",
                dbSessionId, code, reason, remote);

            // Broadcast disconnection to frontend
            Map<String, Object> payload = Map.of(
                "type", "disconnect",
                "code", code,
                "reason", reason != null ? reason : "unknown",
                "timestamp", System.currentTimeMillis()
            );
            messagingTemplate.convertAndSend(
                "/topic/session/" + dbSessionId + "/status", payload);
        }

        @Override
        public void onError(Exception ex) {
            log.error("[BridgeWsClient] WebSocket error | SessionId: {} | Error: {}",
                dbSessionId, ex.getMessage(), ex);

            // Broadcast error to frontend
            Map<String, Object> payload = Map.of(
                "type", "error",
                "message", ex.getMessage(),
                "timestamp", System.currentTimeMillis()
            );
            messagingTemplate.convertAndSend(
                "/topic/session/" + dbSessionId + "/status", payload);
        }

        /**
         * Send input to the bridge
         */
        public void sendInput(String input) {
            try {
                Map<String, Object> msg = Map.of(
                    "type", "input",
                    "content", input
                );
                String json = objectMapper.writeValueAsString(msg);
                this.send(json);
            } catch (Exception e) {
                log.error("[BridgeWsClient] Failed to send input | SessionId: {} | Error: {}",
                    dbSessionId, e.getMessage());
            }
        }

        /**
         * Check if connection is open
         */
        public boolean isConnectionOpen() {
            return this.isOpen();
        }
    }
}
