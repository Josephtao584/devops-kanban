package com.devops.kanban.infrastructure.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Parses output from Claude Code CLI.
 * Handles JSON parsing and ANSI code stripping.
 */
@Service
@Slf4j
public class OutputParser {

    private static final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Strip ANSI escape codes and control characters from input string.
     * PTY output contains escape sequences and line wrapping that need to be removed before JSON parsing.
     *
     * @param input the raw input string
     * @return cleaned string without ANSI codes
     */
    public String stripAnsiCodes(String input) {
        if (input == null) {
            return "";
        }
        return input
                // CSI sequences (most common ANSI codes): ESC [ ... <final byte>
                .replaceAll("\\x1B\\[[0-?]*[ -/]*[@-~]", "")
                // OSC sequences (operating system commands): ESC ] ... BEL or ESC ] ... ESC \
                .replaceAll("\\x1B\\][^\\x07\\x1B]*(?:\\x07|\\x1B\\\\)", "")
                // Character set selection: ESC ( or ESC )
                .replaceAll("\\x1B[()(AB012]", "")
                // Reverse index and next line
                .replaceAll("\\x1B[78]", "")
                // Application mode
                .replaceAll("\\x1B[=>]", "")
                // Remove all control characters including CR (0x0D) and LF (0x0A)
                .replaceAll("[\\x00-\\x1F\\x7F]", "")
                // Also remove any remaining [X sequences (simplified ANSI without ESC)
                .replaceAll("\\[[0-9;]*[A-Za-z]", "");
    }

    /**
     * Parse Claude session ID from JSON output.
     *
     * @param rawOutput the raw output string
     * @return the session ID, or null if not found
     */
    public String parseSessionId(String rawOutput) {
        String cleanJson = stripAnsiCodes(rawOutput.trim());
        JsonNode jsonNode = parseJson(cleanJson);
        if (jsonNode != null && jsonNode.has("session_id")) {
            return jsonNode.get("session_id").asText();
        }
        return null;
    }

    /**
     * Parse result field from JSON output.
     *
     * @param rawOutput the raw output string
     * @return the result text, or null if not found
     */
    public String parseResult(String rawOutput) {
        String cleanJson = stripAnsiCodes(rawOutput.trim());
        JsonNode jsonNode = parseJson(cleanJson);
        if (jsonNode != null && jsonNode.has("result")) {
            return jsonNode.get("result").asText();
        }
        return cleanJson; // Return cleaned output as fallback
    }

    /**
     * Check if output contains a valid JSON object.
     *
     * @param output the output string
     * @return true if valid JSON object found
     */
    public boolean hasValidJson(String output) {
        if (output == null || output.isEmpty()) {
            return false;
        }
        String cleanOutput = stripAnsiCodes(output.trim());
        int jsonStart = cleanOutput.indexOf('{');
        int jsonEnd = cleanOutput.lastIndexOf('}');
        return jsonStart >= 0 && jsonEnd > jsonStart;
    }

    /**
     * Parse JSON from output, handling leading/trailing garbage.
     *
     * @param cleanOutput the cleaned output string
     * @return the parsed JSON node, or null if parsing fails
     */
    private JsonNode parseJson(String cleanOutput) {
        if (cleanOutput == null || cleanOutput.isEmpty()) {
            return null;
        }

        try {
            int jsonStart = cleanOutput.indexOf('{');
            int jsonEnd = cleanOutput.lastIndexOf('}');
            if (jsonStart >= 0 && jsonEnd > jsonStart) {
                String jsonString = cleanOutput.substring(jsonStart, jsonEnd + 1);
                return objectMapper.readTree(jsonString);
            }
        } catch (Exception e) {
            log.debug("Failed to parse JSON: {}", e.getMessage());
        }
        return null;
    }
}
