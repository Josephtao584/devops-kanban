package com.devops.kanban.repository;

import com.devops.kanban.entity.PhaseTransitionRule;
import java.util.List;
import java.util.Optional;

/**
 * Repository interface for PhaseTransitionRule entities.
 */
public interface PhaseTransitionRuleRepository {

    /**
     * Find all rules.
     */
    List<PhaseTransitionRule> findAll();

    /**
     * Find rule by ID.
     */
    Optional<PhaseTransitionRule> findById(Long id);

    /**
     * Find all enabled rules for a given source phase, ordered by priority descending.
     */
    List<PhaseTransitionRule> findByFromPhaseAndEnabledTrueOrderByPriorityDesc(String fromPhase);

    /**
     * Find all enabled rules ordered by priority descending.
     */
    List<PhaseTransitionRule> findByEnabledTrueOrderByPriorityDesc();

    /**
     * Save a rule.
     */
    PhaseTransitionRule save(PhaseTransitionRule rule);

    /**
     * Delete a rule by ID.
     */
    void deleteById(Long id);

    /**
     * Delete all rules.
     */
    void deleteAll();

    /**
     * Get next available ID.
     */
    Long getNextId();

    /**
     * Check if any rules exist.
     */
    boolean existsAny();
}
