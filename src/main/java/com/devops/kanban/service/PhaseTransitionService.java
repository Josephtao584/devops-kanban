package com.devops.kanban.service;

import com.devops.kanban.entity.PhaseTransitionRule;
import com.devops.kanban.entity.Session;
import com.devops.kanban.entity.Task;
import com.devops.kanban.repository.PhaseTransitionRuleRepository;
import com.devops.kanban.repository.SessionRepository;
import com.devops.kanban.repository.TaskRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Service for analyzing AI agent output and triggering automatic phase transitions.
 * When an AI agent completes work, this service analyzes the output for keywords
 * and transitions the task to the next phase or rolls back on failure.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class PhaseTransitionService {

    private final PhaseTransitionRuleRepository ruleRepository;
    private final TaskRepository taskRepository;
    private final SessionRepository sessionRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Result of a phase transition analysis.
     */
    @Getter
    @RequiredArgsConstructor
    public static class TransitionResult {
        private final boolean transitioned;
        private final String fromPhase;
        private final String toPhase;
        private final String reason;
        private final boolean isRollback;

        public static TransitionResult noTransition() {
            return new TransitionResult(false, null, null, null, false);
        }

        public static TransitionResult forward(String from, String to, String reason) {
            return new TransitionResult(true, from, to, reason, false);
        }

        public static TransitionResult rollback(String from, String to, String reason) {
            return new TransitionResult(true, from, to, reason, true);
        }
    }

    /**
     * Analyze session output and trigger phase transition if applicable.
     * This method is called when an AI agent session ends.
     *
     * @param sessionId the session ID
     * @param exitCode  the process exit code
     * @param output    the accumulated output from the session
     * @return Optional containing TransitionResult if a transition occurred
     */
    public Optional<TransitionResult> analyzeAndTransition(Long sessionId, int exitCode, String output) {
        log.info("[PhaseTransition] Analyzing session {} | exitCode={}", sessionId, exitCode);

        // Get session and task
        Session session = sessionRepository.findById(sessionId).orElse(null);
        if (session == null) {
            log.warn("[PhaseTransition] Session not found: {}", sessionId);
            return Optional.empty();
        }

        Long taskId = session.getTaskId();
        if (taskId == null) {
            log.warn("[PhaseTransition] Session {} has no associated task", sessionId);
            return Optional.empty();
        }

        Task task = taskRepository.findById(taskId).orElse(null);
        if (task == null) {
            log.warn("[PhaseTransition] Task not found: {}", taskId);
            return Optional.empty();
        }

        // Check if auto transition is enabled for this task (default to true if not specified)
        boolean autoEnabled = task.getAutoTransitionEnabled() == null || task.getAutoTransitionEnabled();
        if (!autoEnabled) {
            log.info("[PhaseTransition] Auto transition disabled for task {}", taskId);
            return Optional.empty();
        }

        String currentPhase = task.getStatus().name();
        log.info("[PhaseTransition] Task {} current phase: {}", taskId, currentPhase);

        // Find applicable rules
        List<PhaseTransitionRule> rules = ruleRepository
                .findByFromPhaseAndEnabledTrueOrderByPriorityDesc(currentPhase);

        if (rules.isEmpty()) {
            log.debug("[PhaseTransition] No rules for phase: {}", currentPhase);
            return Optional.empty();
        }

        // Convert output to lowercase for case-insensitive matching
        String lowerOutput = output != null ? output.toLowerCase() : "";

        // Evaluate rules by priority
        for (PhaseTransitionRule rule : rules) {
            TransitionResult result = evaluateRule(rule, exitCode, lowerOutput);
            if (result.isTransitioned()) {
                // Execute the transition
                executeTransition(task, result, session);
                return Optional.of(result);
            }
        }

        log.debug("[PhaseTransition] No matching rules for task {}", taskId);
        return Optional.empty();
    }

    /**
     * Evaluate a single rule against the session output.
     */
    private TransitionResult evaluateRule(PhaseTransitionRule rule, int exitCode, String lowerOutput) {
        // First check for failure keywords (higher priority for rollback)
        if (rule.isAutoRollback() && rule.getRollbackPhase() != null) {
            List<String> failureKeywords = parseKeywords(rule.getFailureKeywords());
            for (String keyword : failureKeywords) {
                if (lowerOutput.contains(keyword.toLowerCase())) {
                    log.info("[PhaseTransition] Failure keyword matched: '{}' -> rolling back to {}",
                            keyword, rule.getRollbackPhase());
                    return TransitionResult.rollback(
                            rule.getFromPhase(),
                            rule.getRollbackPhase(),
                            "Failure keyword detected: " + keyword
                    );
                }
            }
        }

        // Then check for completion keywords
        if (rule.isAutoTransition() && rule.getToPhase() != null) {
            List<String> completionKeywords = parseKeywords(rule.getCompletionKeywords());
            for (String keyword : completionKeywords) {
                if (lowerOutput.contains(keyword.toLowerCase())) {
                    log.info("[PhaseTransition] Completion keyword matched: '{}' -> transitioning to {}",
                            keyword, rule.getToPhase());
                    return TransitionResult.forward(
                            rule.getFromPhase(),
                            rule.getToPhase(),
                            "Completion keyword detected: " + keyword
                    );
                }
            }
        }

        return TransitionResult.noTransition();
    }

    /**
     * Execute the phase transition.
     */
    private void executeTransition(Task task, TransitionResult result, Session session) {
        try {
            // Update task status
            Task.TaskStatus newStatus = Task.TaskStatus.valueOf(result.getToPhase());
            task.setStatus(newStatus);
            taskRepository.save(task);

            log.info("[PhaseTransition] Task {} transitioned: {} -> {} ({})",
                    task.getId(), result.getFromPhase(), result.getToPhase(),
                    result.isRollback() ? "ROLLBACK" : "FORWARD");

            // Broadcast transition event via WebSocket
            broadcastTransition(task.getId(), result, session.getId());

        } catch (IllegalArgumentException e) {
            log.error("[PhaseTransition] Invalid target phase: {}", result.getToPhase(), e);
        }
    }

    /**
     * Broadcast phase transition event via WebSocket.
     */
    private void broadcastTransition(Long taskId, TransitionResult result, Long sessionId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "phase_transition");
        payload.put("taskId", taskId);
        payload.put("sessionId", sessionId);
        payload.put("fromPhase", result.getFromPhase());
        payload.put("toPhase", result.getToPhase());
        payload.put("reason", result.getReason());
        payload.put("isRollback", result.isRollback());
        payload.put("timestamp", System.currentTimeMillis());

        // Broadcast to task-specific topic
        messagingTemplate.convertAndSend("/topic/task/" + taskId + "/transition", payload);

        // Also broadcast to global topic for kanban board updates
        messagingTemplate.convertAndSend("/topic/phase-transitions", payload);

        log.debug("[PhaseTransition] Broadcasted transition event for task {}", taskId);
    }

    /**
     * Parse JSON array of keywords.
     */
    private List<String> parseKeywords(String keywordsJson) {
        if (keywordsJson == null || keywordsJson.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(keywordsJson, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            log.warn("[PhaseTransition] Failed to parse keywords: {}", keywordsJson, e);
            return List.of();
        }
    }

    /**
     * Manually trigger phase transition analysis for a task.
     * Useful for testing or manual intervention.
     *
     * @param taskId the task ID
     * @return Optional containing TransitionResult if a transition occurred
     */
    public Optional<TransitionResult> analyzeTask(Long taskId) {
        Task task = taskRepository.findById(taskId).orElse(null);
        if (task == null) {
            log.warn("[PhaseTransition] Task not found: {}", taskId);
            return Optional.empty();
        }

        // Find the most recent session for this task
        List<Session> sessions = sessionRepository.findByTaskId(taskId);
        if (sessions.isEmpty()) {
            log.debug("[PhaseTransition] No sessions found for task {}", taskId);
            return Optional.empty();
        }

        // Get the most recent session
        Session latestSession = sessions.stream()
                .max((s1, s2) -> {
                    if (s1.getStartedAt() == null) return -1;
                    if (s2.getStartedAt() == null) return 1;
                    return s1.getStartedAt().compareTo(s2.getStartedAt());
                })
                .orElse(sessions.get(0));

        String output = latestSession.getOutput();
        if (output == null || output.isBlank()) {
            log.debug("[PhaseTransition] No output in session {}", latestSession.getId());
            return Optional.empty();
        }

        return analyzeAndTransition(latestSession.getId(), 0, output);
    }

    /**
     * Initialize default rules if no rules exist.
     */
    public void initializeDefaultRules() {
        if (ruleRepository.existsAny()) {
            log.info("[PhaseTransition] Rules already exist, skipping initialization");
            return;
        }

        log.info("[PhaseTransition] Initializing default phase transition rules");

        // Default rules as defined in the plan
        List<PhaseTransitionRule> defaultRules = List.of(
                PhaseTransitionRule.builder()
                        .fromPhase("TODO").toPhase("DESIGN")
                        .completionKeywords("[\"design complete\", \"ready for design\", \"moving to design\"]")
                        .failureKeywords("[]")
                        .autoTransition(true).autoRollback(false)
                        .enabled(true).priority(10)
                        .build(),
                PhaseTransitionRule.builder()
                        .fromPhase("DESIGN").toPhase("DEVELOPMENT")
                        .completionKeywords("[\"design approved\", \"ready for development\", \"implementation complete\", \"design done\"]")
                        .failureKeywords("[]")
                        .autoTransition(true).autoRollback(false)
                        .enabled(true).priority(10)
                        .build(),
                PhaseTransitionRule.builder()
                        .fromPhase("DEVELOPMENT").toPhase("TESTING")
                        .completionKeywords("[\"implementation complete\", \"code written\", \"ready for testing\", \"ready for qa\", \"tests written\", \"development done\"]")
                        .failureKeywords("[]")
                        .autoTransition(true).autoRollback(false)
                        .enabled(true).priority(10)
                        .build(),
                PhaseTransitionRule.builder()
                        .fromPhase("TESTING").toPhase("RELEASE")
                        .completionKeywords("[\"tests passed\", \"qa approved\", \"all tests passing\", \"testing complete\", \"verified\"]")
                        .failureKeywords("[\"test failed\", \"tests failed\", \"test failure\", \"tests failure\", \"failing tests\", \"qa rejected\"]")
                        .rollbackPhase("DEVELOPMENT")
                        .autoTransition(true).autoRollback(true)
                        .enabled(true).priority(10)
                        .build(),
                PhaseTransitionRule.builder()
                        .fromPhase("RELEASE").toPhase("DONE")
                        .completionKeywords("[\"deployed\", \"released\", \"deployment complete\", \"release complete\", \"in production\"]")
                        .failureKeywords("[\"deployment failed\", \"release failed\", \"rollback\"]")
                        .rollbackPhase("TESTING")
                        .autoTransition(true).autoRollback(true)
                        .enabled(true).priority(10)
                        .build()
        );

        for (PhaseTransitionRule rule : defaultRules) {
            ruleRepository.save(rule);
        }

        log.info("[PhaseTransition] Saved {} default rules", defaultRules.size());
    }
}
