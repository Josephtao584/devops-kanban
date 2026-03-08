package com.devops.kanban.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.util.Map;

/**
 * Represents a single chat message in a session.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatMessageDTO {
    private String id;
    private String role;      // "user", "assistant", "system"
    private String content;
    private String timestamp;
    private String contentType;  // "text", "thinking", "tool_use", "tool_result", "permission_denied"

    // Message tree structure (Claude CLI JSONL format)
    private String uuid;        // Message unique identifier
    private String parentUuid;  // Parent message UUID for thread structure

    // Tool call fields
    private String toolCallId;     // Tool call ID (e.g., "toolu_01...")
    private String toolName;       // Tool name (Bash, Read, Edit, Write, etc.)
    private Map<String, Object> toolInput;  // Tool input parameters
    private String toolResult;     // Tool execution result
    private Boolean toolIsError;   // Whether tool execution failed

    // Permission denial fields
    private String permissionResource;  // The denied resource
    private String permissionReason;    // The denial reason
}
