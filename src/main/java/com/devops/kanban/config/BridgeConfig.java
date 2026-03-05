package com.devops.kanban.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration properties for the Node.js Claude Bridge.
 *
 * The bridge provides HTTP API and WebSocket communication for Claude CLI
 * with stream-json output, bypassing PTY compatibility issues.
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "bridge")
public class BridgeConfig {

    /**
     * Whether to use the Node.js bridge instead of PTY
     */
    private boolean enabled = true;

    /**
     * Bridge server host
     */
    private String host = "127.0.0.1";

    /**
     * Bridge server port
     */
    private int port = 3002;

    /**
     * HTTP request timeout in milliseconds
     */
    private int timeout = 10000;

    /**
     * Get the base URL for bridge HTTP API
     */
    public String getBaseUrl() {
        return String.format("http://%s:%d", host, port);
    }

    /**
     * Get the WebSocket URL for bridge
     */
    public String getWsUrl() {
        return String.format("ws://%s:%d/ws", host, port);
    }
}
