package com.devops.kanban.controller;

import com.devops.kanban.dto.ApiResponse;
import com.devops.kanban.dto.PhaseTransitionRuleDTO;
import com.devops.kanban.entity.PhaseTransitionRule;
import com.devops.kanban.repository.PhaseTransitionRuleRepository;
import com.devops.kanban.service.PhaseTransitionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * REST Controller for managing phase transition rules.
 */
@RestController
@RequestMapping("/api/phase-transitions")
@RequiredArgsConstructor
@CrossOrigin(origins = "${app.cors.origins:http://localhost:5173}")
@Slf4j
public class PhaseTransitionController {

    private final PhaseTransitionRuleRepository ruleRepository;
    private final PhaseTransitionService phaseTransitionService;

    @GetMapping("/rules")
    public ResponseEntity<ApiResponse<List<PhaseTransitionRuleDTO>>> getAllRules(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        List<PhaseTransitionRuleDTO> allRules = ruleRepository.findAll().stream()
                .map(this::toDTO)
                .sorted((a, b) -> Integer.compare(b.getPriority(), a.getPriority())) // Sort by priority desc
                .collect(Collectors.toList());

        // Support pagination if requested
        if (page != null && size != null && page >= 0 && size > 0) {
            int start = page * size;
            int end = Math.min(start + size, allRules.size());
            List<PhaseTransitionRuleDTO> pagedRules = allRules.subList(start, end);
            return ResponseEntity.ok(ApiResponse.success(Map.of(
                    "rules", pagedRules,
                    "total", allRules.size(),
                    "page", page,
                    "size", size
            )));
        }

        return ResponseEntity.ok(ApiResponse.success(allRules));
    }

    @GetMapping("/rules/{id}")
    public ResponseEntity<ApiResponse<PhaseTransitionRuleDTO>> getRuleById(@PathVariable Long id) {
        return ruleRepository.findById(id)
                .map(rule -> ResponseEntity.ok(ApiResponse.success(toDTO(rule))))
                .orElse(ResponseEntity.ok(ApiResponse.error("Rule not found: " + id)));
    }

    @PostMapping("/rules")
    public ResponseEntity<ApiResponse<PhaseTransitionRuleDTO>> createRule(
            @Valid @RequestBody PhaseTransitionRuleDTO dto,
            BindingResult bindingResult) {
        if (bindingResult.hasErrors()) {
            String errorMessage = bindingResult.getFieldErrors().stream()
                    .map(error -> error.getField() + ": " + error.getDefaultMessage())
                    .collect(Collectors.joining(", "));
            log.warn("[PhaseTransition] Validation failed: {}", errorMessage);
            return ResponseEntity.badRequest().body(ApiResponse.error("Validation failed: " + errorMessage));
        }

        // Validate phase transition logic
        if (dto.getFromPhase().equals(dto.getToPhase())) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Target phase must be different from source phase"));
        }

        PhaseTransitionRule rule = toEntity(dto);
        rule = ruleRepository.save(rule);
        log.info("[PhaseTransition] Created rule: {} -> {}", rule.getFromPhase(), rule.getToPhase());
        return ResponseEntity.ok(ApiResponse.success("Rule created successfully", toDTO(rule)));
    }

    @PutMapping("/rules/{id}")
    public ResponseEntity<ApiResponse<PhaseTransitionRuleDTO>> updateRule(
            @PathVariable Long id,
            @Valid @RequestBody PhaseTransitionRuleDTO dto,
            BindingResult bindingResult) {
        if (bindingResult.hasErrors()) {
            String errorMessage = bindingResult.getFieldErrors().stream()
                    .map(error -> error.getField() + ": " + error.getDefaultMessage())
                    .collect(Collectors.joining(", "));
            log.warn("[PhaseTransition] Validation failed: {}", errorMessage);
            return ResponseEntity.badRequest().body(ApiResponse.error("Validation failed: " + errorMessage));
        }

        Optional<PhaseTransitionRule> existing = ruleRepository.findById(id);
        if (existing.isEmpty()) {
            return ResponseEntity.ok(ApiResponse.error("Rule not found: " + id));
        }

        // Validate phase transition logic
        if (dto.getFromPhase().equals(dto.getToPhase())) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Target phase must be different from source phase"));
        }

        PhaseTransitionRule rule = toEntity(dto);
        rule.setId(id);
        rule = ruleRepository.save(rule);
        log.info("[PhaseTransition] Updated rule {}: {} -> {}", id, rule.getFromPhase(), rule.getToPhase());
        return ResponseEntity.ok(ApiResponse.success("Rule updated successfully", toDTO(rule)));
    }

    @DeleteMapping("/rules/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteRule(@PathVariable Long id) {
        if (ruleRepository.findById(id).isEmpty()) {
            return ResponseEntity.ok(ApiResponse.error("Rule not found: " + id));
        }
        ruleRepository.deleteById(id);
        log.info("[PhaseTransition] Deleted rule {}", id);
        return ResponseEntity.ok(ApiResponse.success("Rule deleted successfully", null));
    }

    @PostMapping("/rules/initialize")
    public ResponseEntity<ApiResponse<Void>> initializeDefaultRules() {
        phaseTransitionService.initializeDefaultRules();
        log.info("[PhaseTransition] Initialized default rules");
        return ResponseEntity.ok(ApiResponse.success("Default rules initialized", null));
    }

    @PostMapping("/tasks/{taskId}/transition")
    public ResponseEntity<ApiResponse<Map<String, Object>>> triggerTransitionAnalysis(@PathVariable Long taskId) {
        Optional<PhaseTransitionService.TransitionResult> result = phaseTransitionService.analyzeTask(taskId);
        if (result.isPresent()) {
            PhaseTransitionService.TransitionResult transition = result.get();
            Map<String, Object> data = Map.of(
                    "transitioned", transition.isTransitioned(),
                    "fromPhase", transition.getFromPhase() != null ? transition.getFromPhase() : "",
                    "toPhase", transition.getToPhase() != null ? transition.getToPhase() : "",
                    "reason", transition.getReason() != null ? transition.getReason() : "",
                    "isRollback", transition.isRollback()
            );
            return ResponseEntity.ok(ApiResponse.success("Transition triggered", data));
        } else {
            return ResponseEntity.ok(ApiResponse.success("No transition occurred", Map.of("transitioned", false)));
        }
    }

    private PhaseTransitionRuleDTO toDTO(PhaseTransitionRule rule) {
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

    private PhaseTransitionRule toEntity(PhaseTransitionRuleDTO dto) {
        return PhaseTransitionRule.builder()
                .id(dto.getId())
                .fromPhase(dto.getFromPhase())
                .toPhase(dto.getToPhase())
                .completionKeywords(dto.getCompletionKeywords())
                .failureKeywords(dto.getFailureKeywords())
                .rollbackPhase(dto.getRollbackPhase())
                .autoTransition(dto.isAutoTransition())
                .autoRollback(dto.isAutoRollback())
                .enabled(dto.isEnabled())
                .priority(dto.getPriority())
                .build();
    }
}
