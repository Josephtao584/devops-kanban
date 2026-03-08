package com.devops.kanban.controller;

import com.devops.kanban.dto.ApiResponse;
import com.devops.kanban.dto.PhaseTransitionRuleDTO;
import com.devops.kanban.entity.PhaseTransitionRule;
import com.devops.kanban.service.PhaseTransitionRuleService;
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

    private final PhaseTransitionRuleService ruleService;
    private final PhaseTransitionService phaseTransitionService;

    @GetMapping("/rules")
    public ResponseEntity<ApiResponse<?>> getAllRules(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        List<PhaseTransitionRuleDTO> allRules = ruleService.getAllRulesSortedByPriority().stream()
                .map(ruleService::toDTO)
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
        return ruleService.getRuleById(id)
                .map(rule -> ResponseEntity.ok(ApiResponse.success(ruleService.toDTO(rule))))
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

        try {
            PhaseTransitionRule rule = ruleService.createRule(dto);
            return ResponseEntity.ok(ApiResponse.success("Rule created successfully", ruleService.toDTO(rule)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
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

        try {
            PhaseTransitionRule rule = ruleService.updateRule(id, dto);
            return ResponseEntity.ok(ApiResponse.success("Rule updated successfully", ruleService.toDTO(rule)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.ok(ApiResponse.error("Rule not found: " + id));
        }
    }

    @DeleteMapping("/rules/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteRule(@PathVariable Long id) {
        if (ruleService.deleteRule(id)) {
            return ResponseEntity.ok(ApiResponse.success("Rule deleted successfully", null));
        }
        return ResponseEntity.ok(ApiResponse.error("Rule not found: " + id));
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
}
