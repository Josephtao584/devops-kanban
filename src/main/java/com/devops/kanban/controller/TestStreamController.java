package com.devops.kanban.controller;

import com.devops.kanban.dto.ApiResponse;
import com.devops.kanban.entity.Session;
import com.devops.kanban.repository.SessionRepository;
import com.devops.kanban.service.SessionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Test controller for debugging streaming output.
 * This is a temporary controller for verification purposes.
 */
@Slf4j
@RestController
@RequestMapping("/api/test")
@RequiredArgsConstructor
@CrossOrigin(origins = "${app.cors.origins:http://localhost:5173}")
public class TestStreamController {

    private final SessionService sessionService;
    private final SessionRepository sessionRepository;

    /**
     * Test streaming output by creating and starting a session.
     * Usage: POST /api/test/stream?taskId=28&agentId=1
     */
    @PostMapping("/stream")
    public ResponseEntity<ApiResponse<Map<String, Object>>> testStream(
            @RequestParam Long taskId,
            @RequestParam(defaultValue = "1") Long agentId,
            @RequestParam(defaultValue = "hello") String prompt) {

        log.info("[Test] Starting stream test | TaskId: {} | AgentId: {} | Prompt: {}", taskId, agentId, prompt);

        try {
            // Create session
            Session session = sessionService.createSession(taskId, agentId);
            Long sessionId = session.getId();
            log.info("[Test] Session created | SessionId: {}", sessionId);

            // Start session (prompt is set via initialPrompt on the session entity)
            session = sessionService.startSession(sessionId);
            log.info("[Test] Session started | Status: {}", session.getStatus());

            // Wait for session to complete (with timeout)
            int maxWait = 60; // seconds
            int waited = 0;
            while (waited < maxWait) {
                Optional<Session> sessionOpt = sessionRepository.findById(sessionId);
                if (sessionOpt.isPresent()) {
                    Session current = sessionOpt.get();
                    Session.SessionStatus status = current.getStatus();
                    if (status == Session.SessionStatus.STOPPED || status == Session.SessionStatus.ERROR) {
                        log.info("[Test] Session completed | Status: {} | OutputLength: {}",
                            status, current.getOutput() != null ? current.getOutput().length() : 0);
                        break;
                    }
                }
                Thread.sleep(1000);
                waited++;
            }

            // Get final session state
            Optional<Session> finalSessionOpt = sessionRepository.findById(sessionId);
            Map<String, Object> result = new HashMap<>();

            if (finalSessionOpt.isPresent()) {
                Session finalSession = finalSessionOpt.get();
                result.put("sessionId", finalSession.getId());
                result.put("claudeSessionId", finalSession.getClaudeSessionId());
                result.put("status", finalSession.getStatus() != null ? finalSession.getStatus().name() : null);
                result.put("outputLength", finalSession.getOutput() != null ? finalSession.getOutput().length() : 0);
                result.put("output", finalSession.getOutput());
                result.put("messages", finalSession.getMessages());
                result.put("waitTime", waited + "s");
            } else {
                result.put("error", "Session not found");
            }

            return ResponseEntity.ok(ApiResponse.success("Test completed", result));

        } catch (Exception e) {
            log.error("[Test] Error during stream test", e);
            Map<String, Object> errorResult = new HashMap<>();
            errorResult.put("error", e.getMessage());
            errorResult.put("exception", e.getClass().getSimpleName());
            return ResponseEntity.internalServerError().body(ApiResponse.error(e.getMessage(), errorResult));
        }
    }

    /**
     * Get session details by ID.
     * Usage: GET /api/test/session/{sessionId}
     */
    @GetMapping("/session/{sessionId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getSession(@PathVariable Long sessionId) {
        Optional<Session> sessionOpt = sessionRepository.findById(sessionId);

        if (sessionOpt.isEmpty()) {
            return ResponseEntity.ok(ApiResponse.error("Session not found"));
        }

        Session session = sessionOpt.get();
        Map<String, Object> result = new HashMap<>();
        result.put("sessionId", session.getId());
        result.put("claudeSessionId", session.getClaudeSessionId());
        result.put("status", session.getStatus() != null ? session.getStatus().name() : null);
        result.put("outputLength", session.getOutput() != null ? session.getOutput().length() : 0);
        result.put("output", session.getOutput());
        result.put("messages", session.getMessages());

        return ResponseEntity.ok(ApiResponse.success("Session found", result));
    }

    /**
     * Delete session by ID.
     * Usage: DELETE /api/test/session/{sessionId}
     */
    @DeleteMapping("/session/{sessionId}")
    public ResponseEntity<ApiResponse<String>> deleteSession(@PathVariable Long sessionId) {
        try {
            sessionService.deleteSession(sessionId);
            return ResponseEntity.ok(ApiResponse.success("Session deleted", "OK"));
        } catch (Exception e) {
            return ResponseEntity.ok(ApiResponse.error(e.getMessage()));
        }
    }
}
