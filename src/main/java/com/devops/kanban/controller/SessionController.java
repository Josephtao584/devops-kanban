package com.devops.kanban.controller;

import com.devops.kanban.converter.EntityDTOConverter;
import com.devops.kanban.dto.ApiResponse;
import com.devops.kanban.dto.SessionDTO;
import com.devops.kanban.entity.Session;
import com.devops.kanban.service.SessionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * REST and WebSocket controller for AI session management.
 */
@Slf4j
@Controller
@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
@CrossOrigin(origins = "${app.cors.origins:http://localhost:5173}")
public class SessionController {

    private final SessionService sessionService;
    private final EntityDTOConverter converter;

    // ==================== REST API ====================

    /**
     * Create a new session for a task
     */
    @PostMapping
    public ResponseEntity<ApiResponse<SessionDTO>> createSession(
            @Valid @RequestBody SessionDTO dto) {
        log.info("[API] POST /api/sessions | TaskId: {} | AgentId: {}", dto.getTaskId(), dto.getAgentId());
        try {
            Session session = sessionService.createSession(dto.getTaskId(), dto.getAgentId());
            log.info("[API] Session created | SessionId: {} | TaskId: {}", session.getId(), dto.getTaskId());
            return ResponseEntity.ok(ApiResponse.success("Session created", toDTO(session)));
        } catch (IllegalArgumentException e) {
            log.warn("[API] Invalid session request | TaskId: {} | Error: {}", dto.getTaskId(), e.getMessage());
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        } catch (IllegalStateException e) {
            log.warn("[API] Session state error | TaskId: {} | Error: {}", dto.getTaskId(), e.getMessage());
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        } catch (NullPointerException e) {
            log.error("[API] Missing required configuration | TaskId: {} | Error: {}", dto.getTaskId(), e.getMessage());
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Project configuration error: localPath is not configured. Please set the local repository path for this project."));
        } catch (Exception e) {
            log.error("[API] Failed to create session | TaskId: {} | Error: {}", dto.getTaskId(), e.getMessage(), e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("Failed to create session: " + e.getMessage()));
        }
    }

    /**
     * Get session by ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<SessionDTO>> getSession(@PathVariable Long id) {
        log.debug("[API] GET /api/sessions/{}", id);
        return sessionService.getSession(id)
                .map(session -> ResponseEntity.ok(ApiResponse.success(toDTO(session))))
                .orElse(ResponseEntity.ok(ApiResponse.error("Session not found")));
    }

    /**
     * Get sessions by task ID
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<SessionDTO>>> getSessions(
            @RequestParam(required = false) Long taskId,
            @RequestParam(required = false, defaultValue = "false") boolean activeOnly) {

        log.debug("[API] GET /api/sessions | TaskId: {} | ActiveOnly: {}", taskId, activeOnly);

        if (taskId == null) {
            return ResponseEntity.ok(ApiResponse.error("taskId is required"));
        }

        List<SessionDTO> sessions;
        if (activeOnly) {
            sessions = sessionService.getActiveSessionByTaskId(taskId)
                    .map(this::toDTO)
                    .stream()
                    .collect(Collectors.toList());
        } else {
            sessions = sessionService.getSessionsByTaskId(taskId).stream()
                    .map(this::toDTO)
                    .collect(Collectors.toList());
        }

        log.debug("[API] Found {} sessions for TaskId: {}", sessions.size(), taskId);
        return ResponseEntity.ok(ApiResponse.success(sessions));
    }

    /**
     * Get active session for a task
     */
    @GetMapping("/task/{taskId}/active")
    public ResponseEntity<ApiResponse<SessionDTO>> getActiveSession(@PathVariable Long taskId) {
        log.debug("[API] GET /api/sessions/task/{}/active", taskId);
        return sessionService.getActiveSessionByTaskId(taskId)
                .map(session -> ResponseEntity.ok(ApiResponse.success(toDTO(session))))
                .orElse(ResponseEntity.ok(ApiResponse.success(null)));
    }

    /**
     * Get session history for a task with output
     */
    @GetMapping("/task/{taskId}/history")
    public ResponseEntity<ApiResponse<List<SessionDTO>>> getSessionHistory(
            @PathVariable Long taskId,
            @RequestParam(required = false, defaultValue = "true") boolean includeOutput) {
        log.debug("[API] GET /api/sessions/task/{}/history | IncludeOutput: {}", taskId, includeOutput);
        List<Session> sessions = sessionService.getSessionsWithOutputByTaskId(taskId);
        List<SessionDTO> dtos = sessions.stream()
                .map(session -> toDTO(session, includeOutput))
                .collect(Collectors.toList());
        log.debug("[API] Retrieved {} session history entries for TaskId: {}", dtos.size(), taskId);
        return ResponseEntity.ok(ApiResponse.success(dtos));
    }

    /**
     * Start a session
     */
    @PostMapping("/{id}/start")
    public ResponseEntity<ApiResponse<SessionDTO>> startSession(@PathVariable Long id) {
        log.info("[API] POST /api/sessions/{}/start", id);
        try {
            Session session = sessionService.startSession(id);
            log.info("[API] Session started | SessionId: {} | Status: {}", id, session.getStatus());
            return ResponseEntity.ok(ApiResponse.success("Session started", toDTO(session)));
        } catch (Exception e) {
            log.error("[API] Failed to start session | SessionId: {} | Error: {}", id, e.getMessage());
            return ResponseEntity.ok(ApiResponse.error("Failed to start session: " + e.getMessage()));
        }
    }

    /**
     * Stop a session
     */
    @PostMapping("/{id}/stop")
    public ResponseEntity<ApiResponse<SessionDTO>> stopSession(@PathVariable Long id) {
        log.info("[API] POST /api/sessions/{}/stop", id);
        try {
            Session session = sessionService.stopSession(id);
            log.info("[API] Session stopped | SessionId: {} | Status: {}", id, session.getStatus());
            return ResponseEntity.ok(ApiResponse.success("Session stopped", toDTO(session)));
        } catch (Exception e) {
            log.error("[API] Failed to stop session | SessionId: {} | Error: {}", id, e.getMessage());
            return ResponseEntity.ok(ApiResponse.error("Failed to stop session: " + e.getMessage()));
        }
    }

    /**
     * Send input to a session
     */
    @PostMapping("/{id}/input")
    public ResponseEntity<ApiResponse<Void>> sendInput(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        String input = body.get("input");
        if (input == null || input.trim().isEmpty()) {
            log.warn("[API] POST /api/sessions/{}/input - empty input rejected", id);
            return ResponseEntity.ok(ApiResponse.error("Input is required"));
        }

        log.debug("[API] POST /api/sessions/{}/input | Length: {} chars", id, input.length());
        boolean success = sessionService.sendInput(id, input);
        if (success) {
            log.debug("[API] Input sent successfully | SessionId: {}", id);
            return ResponseEntity.ok(ApiResponse.success("Input sent", null));
        } else {
            log.warn("[API] Failed to send input | SessionId: {}", id);
            return ResponseEntity.ok(ApiResponse.error("Failed to send input"));
        }
    }

    /**
     * Continue a stopped session with new input
     * This will resume the session using Claude CLI's --resume flag
     */
    @PostMapping("/{id}/continue")
    public ResponseEntity<ApiResponse<SessionDTO>> continueSession(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        String input = body.get("input");
        if (input == null || input.trim().isEmpty()) {
            log.warn("[API] POST /api/sessions/{}/continue - empty input rejected", id);
            return ResponseEntity.ok(ApiResponse.error("Input is required"));
        }

        log.info("[API] POST /api/sessions/{}/continue | Length: {} chars", id, input.length());
        try {
            boolean success = sessionService.continueSession(id, input);
            if (success) {
                Session session = sessionService.getSession(id)
                        .orElseThrow(() -> new IllegalStateException("Session not found after continue"));
                log.info("[API] Session continued successfully | SessionId: {} | Status: {}", id, session.getStatus());
                return ResponseEntity.ok(ApiResponse.success("Session continued", toDTO(session)));
            } else {
                log.warn("[API] Failed to continue session | SessionId: {}", id);
                return ResponseEntity.ok(ApiResponse.error("Failed to continue session"));
            }
        } catch (IllegalStateException e) {
            log.warn("[API] Session continue failed - invalid state | SessionId: {} | Error: {}", id, e.getMessage());
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.error("[API] Failed to continue session | SessionId: {} | Error: {}", id, e.getMessage(), e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("Failed to continue session: " + e.getMessage()));
        }
    }

    /**
     * Get session output
     */
    @GetMapping("/{id}/output")
    public ResponseEntity<ApiResponse<String>> getSessionOutput(@PathVariable Long id) {
        log.debug("[API] GET /api/sessions/{}/output", id);
        String output = sessionService.getSessionOutput(id);
        log.debug("[API] Retrieved output | SessionId: {} | Length: {} chars", id, output != null ? output.length() : 0);
        return ResponseEntity.ok(ApiResponse.success(output));
    }

    /**
     * Delete a session
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteSession(@PathVariable Long id) {
        log.info("[API] DELETE /api/sessions/{}", id);
        try {
            sessionService.deleteSession(id);
            log.info("[API] Session deleted | SessionId: {}", id);
            return ResponseEntity.ok(ApiResponse.success("Session deleted", null));
        } catch (Exception e) {
            log.error("[API] Failed to delete session | SessionId: {} | Error: {}", id, e.getMessage());
            return ResponseEntity.ok(ApiResponse.error("Failed to delete session: " + e.getMessage()));
        }
    }

    // ==================== WebSocket Handlers ====================

    /**
     * WebSocket endpoint for sending input to a session
     * Client sends to: /app/session/{sessionId}/input
     */
    @MessageMapping("/session/{sessionId}/input")
    public void handleInput(
            @DestinationVariable Long sessionId,
            @Payload Map<String, String> payload) {
        String input = payload.get("input");
        if (input != null && !input.trim().isEmpty()) {
            log.debug("[WS] Received input for session {} | Length: {} chars", sessionId, input.length());
            sessionService.sendInput(sessionId, input);
        } else {
            log.warn("[WS] Empty input received for session {}", sessionId);
        }
    }

    // ==================== DTO Conversion ====================

    private SessionDTO toDTO(Session session) {
        return toDTO(session, true);
    }

    private SessionDTO toDTO(Session session, boolean includeOutput) {
        SessionDTO dto = converter.toDTO(session, includeOutput);
        if (includeOutput && (dto.getOutput() == null || dto.getOutput().isEmpty())) {
            // Fall back to process manager output
            String output = sessionService.getSessionOutput(session.getId());
            dto.setOutput(output);
        }
        return dto;
    }
}
