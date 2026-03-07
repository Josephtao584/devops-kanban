package com.devops.kanban.entity;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

/**
 * Represents a rule for automatic phase transitions in task workflow.
 * When AI agent completes work, the system can automatically transition
 * the task to the next phase based on these rules.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PhaseTransitionRule {
    private Long id;

    /**
     * Source phase (from Task.TaskStatus)
     */
    private String fromPhase;

    /**
     * Target phase for forward transition
     */
    private String toPhase;

    /**
     * Keywords that trigger forward transition (JSON array of strings)
     * e.g., ["design complete", "ready for development"]
     */
    private String completionKeywords;

    /**
     * Keywords that trigger rollback (JSON array of strings)
     * e.g., ["test failed", "tests failed"]
     */
    private String failureKeywords;

    /**
     * Target phase for rollback when failure keywords are detected
     */
    private String rollbackPhase;

    /**
     * Enable automatic forward transition
     */
    private boolean autoTransition;

    /**
     * Enable automatic rollback on failure
     */
    private boolean autoRollback;

    /**
     * Rule is enabled
     */
    private boolean enabled;

    /**
     * Priority for rule evaluation (higher priority rules are evaluated first)
     */
    private int priority;
}
