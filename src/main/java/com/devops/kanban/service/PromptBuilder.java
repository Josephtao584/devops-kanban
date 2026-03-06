package com.devops.kanban.service;

import com.devops.kanban.dto.TaskDTO;
import org.springframework.stereotype.Service;

/**
 * Builds prompts for AI agent execution.
 * Extracted from SessionService to improve separation of concerns.
 */
@Service
public class PromptBuilder {

    private static final String DEFAULT_INSTRUCTION = "Please complete this task. Make the necessary changes and ensure the code works correctly.";

    /**
     * Build an initial prompt from a task.
     *
     * @param task the task to build prompt for
     * @return the constructed prompt
     */
    public String buildInitialPrompt(TaskDTO task) {
        if (task == null) {
            return "";
        }

        StringBuilder prompt = new StringBuilder();
        prompt.append("**Task:** ").append(task.getTitle()).append("\n");

        if (task.getDescription() != null && !task.getDescription().isEmpty()) {
            prompt.append("**Description:** ").append(task.getDescription()).append("\n");
        }

        prompt.append("\n").append(DEFAULT_INSTRUCTION);

        return prompt.toString();
    }

    /**
     * Build a prompt with custom instruction.
     *
     * @param task the task to build prompt for
     * @param customInstruction custom instruction to append
     * @return the constructed prompt
     */
    public String buildPromptWithInstruction(TaskDTO task, String customInstruction) {
        if (task == null) {
            return customInstruction != null ? customInstruction : "";
        }

        StringBuilder prompt = new StringBuilder();
        prompt.append("**Task:** ").append(task.getTitle()).append("\n");

        if (task.getDescription() != null && !task.getDescription().isEmpty()) {
            prompt.append("**Description:** ").append(task.getDescription()).append("\n");
        }

        prompt.append("\n");

        if (customInstruction != null && !customInstruction.isEmpty()) {
            prompt.append(customInstruction);
        } else {
            prompt.append(DEFAULT_INSTRUCTION);
        }

        return prompt.toString();
    }
}