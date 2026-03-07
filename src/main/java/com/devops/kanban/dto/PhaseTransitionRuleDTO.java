package com.devops.kanban.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import jakarta.validation.constraints.*;

/**
 * DTO for PhaseTransitionRule entity.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PhaseTransitionRuleDTO {
    private Long id;

    @NotBlank(message = "Source phase is required")
    @Pattern(regexp = "^(TODO|DESIGN|DEVELOPMENT|TESTING|RELEASE|DONE)$",
            message = "Invalid source phase. Must be one of: TODO, DESIGN, DEVELOPMENT, TESTING, RELEASE, DONE")
    private String fromPhase;

    @NotBlank(message = "Target phase is required")
    @Pattern(regexp = "^(TODO|DESIGN|DEVELOPMENT|TESTING|RELEASE|DONE)$",
            message = "Invalid target phase. Must be one of: TODO, DESIGN, DEVELOPMENT, TESTING, RELEASE, DONE")
    private String toPhase;

    private String completionKeywords;
    private String failureKeywords;

    @Pattern(regexp = "^(TODO|DESIGN|DEVELOPMENT|TESTING|RELEASE|DONE)?$",
            message = "Invalid rollback phase. Must be one of: TODO, DESIGN, DEVELOPMENT, TESTING, RELEASE, DONE")
    private String rollbackPhase;

    private boolean autoTransition;
    private boolean autoRollback;
    private boolean enabled;

    @Min(value = 1, message = "Priority must be at least 1")
    @Max(value = 100, message = "Priority must not exceed 100")
    private int priority;
}
