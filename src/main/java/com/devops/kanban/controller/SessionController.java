package com.devops.kanban.controller;

import com.devops.kanban.dto.ApiResponse;
import com.devops.kanban.dto.SessionDTO;
import com.devops.kanban.entity.Session;
import com.devops.kanban.service.SessionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
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
@Controller
@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
@CrossOrigin(origins = "${app.cors.origins:http://localhost:5173}")
public class SessionController {

    private final SessionService sessionService;

    // ==================== REST API ====================

    /**
     * Create a new session for a task
     */
    @PostMapping
    public ResponseEntity<ApiResponse<SessionDTO>> createSession(
            @Valid @RequestBody SessionDTO dto) {
        Session session = sessionService.createSession(dto.getTaskId(), dto.getAgentId());
        return ResponseEntity.ok(ApiResponse.success("Session created", toDTO(session)));
    }

    /**
     * Get session by ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<SessionDTO>> getSession(@PathVariable Long id) {
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

        return ResponseEntity.ok(ApiResponse.success(sessions));
    }

    /**
     * Get active session for a task
     */
    @GetMapping("/task/{taskId}/active")
    public ResponseEntity<ApiResponse<SessionDTO>> getActiveSession(@PathVariable Long taskId) {
        return sessionService.getActiveSessionByTaskId(taskId)
                .map(session -> ResponseEntity.ok(ApiResponse.success(toDTO(session))))
                .orElse(ResponseEntity.ok(ApiResponse.success(null)));
    }

    /**
     * Start a session
     */
    @PostMapping("/{id}/start")
    public ResponseEntity<ApiResponse<SessionDTO>> startSession(@PathVariable Long id) {
        try {
            Session session = sessionService.startSession(id);
            return ResponseEntity.ok(ApiResponse.success("Session started", toDTO(session)));
        } catch (Exception e) {
            return ResponseEntity.ok(ApiResponse.error("Failed to start session: " + e.getMessage()));
        }
    }

    /**
     * Stop a session
     */
    @PostMapping("/{id}/stop")
    public ResponseEntity<ApiResponse<SessionDTO>> stopSession(@PathVariable Long id) {
        try {
            Session session = sessionService.stopSession(id);
            return ResponseEntity.ok(ApiResponse.success("Session stopped", toDTO(session)));
        } catch (Exception e) {
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
            return ResponseEntity.ok(ApiResponse.error("Input is required"));
        }

        boolean success = sessionService.sendInput(id, input);
        if (success) {
            return ResponseEntity.ok(ApiResponse.success("Input sent", null));
        } else {
            return ResponseEntity.ok(ApiResponse.error("Failed to send input"));
        }
    }

    /**
     * Get session output
     */
    @GetMapping("/{id}/output")
    public ResponseEntity<ApiResponse<String>> getSessionOutput(@PathVariable Long id) {
        String output = sessionService.getSessionOutput(id);
        return ResponseEntity.ok(ApiResponse.success(output));
    }

    /**
     * Delete a session
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteSession(@PathVariable Long id) {
        try {
            sessionService.deleteSession(id);
            return ResponseEntity.ok(ApiResponse.success("Session deleted", null));
        } catch (Exception e) {
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
            sessionService.sendInput(sessionId, input);
        }
    }

    // ==================== DTO Conversion ====================

    private SessionDTO toDTO(Session session) {
        return SessionDTO.builder()
                .id(session.getId())
                .taskId(session.getTaskId())
                .agentId(session.getAgentId())
                .status(session.getStatus() != null ? session.getStatus().name() : "CREATED")
                .worktreePath(session.getWorktreePath())
                .branch(session.getBranch())
                .sessionId(session.getSessionId())
                .startedAt(session.getStartedAt())
                .lastHeartbeat(session.getLastHeartbeat())
                .stoppedAt(session.getStoppedAt())
                .output(sessionService.getSessionOutput(session.getId()))
                .build();
    }
}
