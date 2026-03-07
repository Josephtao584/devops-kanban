package com.devops.kanban.service;

import com.devops.kanban.dto.PhaseTransitionRuleDTO;
import com.devops.kanban.entity.PhaseTransitionRule;
import com.devops.kanban.repository.PhaseTransitionRuleRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Service for managing phase transition rules.
 * Encapsulates all repository operations and business logic.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PhaseTransitionRuleService {

    private final PhaseTransitionRuleRepository ruleRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    // ==================== Query Operations ====================

    /**
     * Get all rules.
     * @return list of all rules
     */
    public List<PhaseTransitionRule> getAllRules() {
        return ruleRepository.findAll();
    }

    /**
     * Get all rules sorted by priority (highest first).
     * @return list of rules sorted by priority descending
     */
    public List<PhaseTransitionRule> getAllRulesSortedByPriority() {
        return ruleRepository.findAll().stream()
                .sorted((a, b) -> Integer.compare(b.getPriority(), a.getPriority()))
                .collect(Collectors.toList());
    }

    /**
     * Get rule by ID.
     * @param id the rule ID
     * @return Optional containing the rule
     */
    public Optional<PhaseTransitionRule> getRuleById(Long id) {
        return ruleRepository.findById(id);
    }

    /**
     * Get all enabled rules ordered by priority.
     * @return list of enabled rules
     */
    public List<PhaseTransitionRule> getEnabledRules() {
        return ruleRepository.findByEnabledTrueOrderByPriorityDesc();
    }

    /**
     * Get enabled rules for a specific source phase.
     * @param fromPhase the source phase
     * @return list of matching rules
     */
    public List<PhaseTransitionRule> getEnabledRulesForPhase(String fromPhase) {
        return ruleRepository.findByFromPhaseAndEnabledTrueOrderByPriorityDesc(fromPhase);
    }

    // ==================== CRUD Operations ====================

    /**
     * Create a new rule.
     * @param dto the rule DTO
     * @return the created rule
     */
    public PhaseTransitionRule createRule(PhaseTransitionRuleDTO dto) {
        validateRule(dto);
        PhaseTransitionRule rule = toEntity(dto);
        rule = ruleRepository.save(rule);
        log.info("[PhaseTransitionRule] Created rule: {} -> {}", rule.getFromPhase(), rule.getToPhase());
        return rule;
    }

    /**
     * Update an existing rule.
     * @param id the rule ID
     * @param dto the updated rule DTO
     * @return the updated rule
     * @throws IllegalArgumentException if rule not found
     */
    public PhaseTransitionRule updateRule(Long id, PhaseTransitionRuleDTO dto) {
        if (ruleRepository.findById(id).isEmpty()) {
            throw new IllegalArgumentException("Rule not found: " + id);
        }
        validateRule(dto);
        PhaseTransitionRule rule = toEntity(dto);
        rule.setId(id);
        rule = ruleRepository.save(rule);
        log.info("[PhaseTransitionRule] Updated rule {}: {} -> {}", id, rule.getFromPhase(), rule.getToPhase());
        return rule;
    }

    /**
     * Delete a rule by ID.
     * @param id the rule ID
     * @return true if deleted, false if not found
     */
    public boolean deleteRule(Long id) {
        if (ruleRepository.findById(id).isEmpty()) {
            return false;
        }
        ruleRepository.deleteById(id);
        log.info("[PhaseTransitionRule] Deleted rule {}", id);
        return true;
    }

    // ==================== Utility Operations ====================

    /**
     * Check if any rules exist.
     * @return true if rules exist
     */
    public boolean existsAny() {
        return ruleRepository.existsAny();
    }

    /**
     * Delete all rules.
     */
    public void deleteAllRules() {
        ruleRepository.deleteAll();
        log.info("[PhaseTransitionRule] Deleted all rules");
    }

    // ==================== Conversion Methods ====================

    /**
     * Convert entity to DTO.
     * @param rule the entity
     * @return the DTO
     */
    public PhaseTransitionRuleDTO toDTO(PhaseTransitionRule rule) {
        return PhaseTransitionRuleDTO.builder()
                .id(rule.getId())
                .fromPhase(rule.getFromPhase())
                .toPhase(rule.getToPhase())
                .completionKeywords(rule.getCompletionKeywords())
                .failureKeywords(rule.getFailureKeywords())
                .rollbackPhase(rule.getRollbackPhase())
                .autoTransition(rule.isAutoTransition())
                .autoRollback(rule.isAutoRollback())
                .enabled(rule.isEnabled())
                .priority(rule.getPriority())
                .build();
    }

    /**
     * Convert DTO to entity.
     * @param dto the DTO
     * @return the entity
     */
    public PhaseTransitionRule toEntity(PhaseTransitionRuleDTO dto) {
        // Normalize keywords JSON format before saving
        String normalizedCompletion = normalizeKeywordsJson(dto.getCompletionKeywords());
        String normalizedFailure = normalizeKeywordsJson(dto.getFailureKeywords());

        return PhaseTransitionRule.builder()
                .id(dto.getId())
                .fromPhase(dto.getFromPhase())
                .toPhase(dto.getToPhase())
                .completionKeywords(normalizedCompletion)
                .failureKeywords(normalizedFailure)
                .rollbackPhase(dto.getRollbackPhase())
                .autoTransition(dto.isAutoTransition())
                .autoRollback(dto.isAutoRollback())
                .enabled(dto.isEnabled())
                .priority(dto.getPriority())
                .build();
    }

    // ==================== Validation Methods ====================

    /**
     * Validate rule data.
     * @param dto the rule DTO
     * @throws IllegalArgumentException if validation fails
     */
    public void validateRule(PhaseTransitionRuleDTO dto) {
        if (dto.getFromPhase().equals(dto.getToPhase())) {
            throw new IllegalArgumentException("Target phase must be different from source phase");
        }
    }

    /**
     * Validate and normalize keywords JSON format.
     * Returns a valid JSON array string or "[]" if invalid.
     * @param keywordsJson the keywords JSON string
     * @return normalized JSON array string
     */
    public String normalizeKeywordsJson(String keywordsJson) {
        if (keywordsJson == null || keywordsJson.isBlank()) {
            return "[]";
        }

        try {
            // Try to parse as JSON array
            List<String> keywords = objectMapper.readValue(keywordsJson, new TypeReference<List<String>>() {});

            // Normalize: trim whitespace, remove empty strings, convert back to JSON
            List<String> normalized = keywords.stream()
                    .filter(k -> k != null && !k.isBlank())
                    .map(String::trim)
                    .distinct()
                    .collect(Collectors.toList());

            return objectMapper.writeValueAsString(normalized);
        } catch (Exception e) {
            log.warn("[PhaseTransitionRule] Invalid keywords JSON format: {}", keywordsJson);
            return "[]";
        }
    }
}
