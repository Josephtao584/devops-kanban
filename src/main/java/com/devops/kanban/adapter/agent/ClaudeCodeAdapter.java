package com.devops.kanban.adapter.agent;

import com.devops.kanban.dto.TaskDTO;
import com.devops.kanban.entity.Agent;
import com.devops.kanban.entity.Execution;
import com.devops.kanban.spi.AgentAdapter;
import com.devops.kanban.util.PlatformUtils;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.nio.file.Path;

/**
 * Claude Code CLI adapter - executes tasks using Claude Code.
 */
@Component
public class ClaudeCodeAdapter implements AgentAdapter {

    private final ObjectMapper mapper = new ObjectMapper();
    
    /**
     * Default Claude CLI path - can be overridden via configuration
     */
    private String claudeCliPath = null;

    public ClaudeCodeAdapter() {
        // Try to detect claude CLI path using platform-aware logic
        if (PlatformUtils.isWindows()) {
            // Use APPDATA environment variable for Windows
            String appData = System.getenv("APPDATA");
            if (appData != null) {
                this.claudeCliPath = appData + "\\npm\\node_modules\\@anthropic-ai\\claude-code\\cli.js";
            } else {
                // Fallback to user home
                this.claudeCliPath = PlatformUtils.getHomeDirectory() + "\\AppData\\Roaming\\npm\\node_modules\\@anthropic-ai\\claude-code\\cli.js";
            }
        } else {
            // On Unix, assume 'claude' is in PATH
            this.claudeCliPath = "claude";
        }
    }

    /**
     * Get the Claude CLI path
     * @return the path to the Claude CLI executable
     */
    public String getClaudeCliPath() {
        return claudeCliPath;
    }
    
    /**
     * Set the Claude CLI path
     * @param claudeCliPath the path to the Claude CLI executable
     */
    public void setClaudeCliPath(String claudeCliPath) {
        this.claudeCliPath = claudeCliPath;
    }

    @Override
    public Agent.AgentType getType() {
        return Agent.AgentType.CLAUDE;
    }

    @Override
    public boolean validateConfig(String configJson) {
        if (configJson == null || configJson.isEmpty()) {
            return true; // Config is optional
        }
        try {
            mapper.readTree(configJson);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public String buildCommand(Agent agent, TaskDTO task, Path worktreePath) {
        String commandTemplate = agent.getCommand();
        if (commandTemplate == null || commandTemplate.isEmpty()) {
            commandTemplate = "claude --prompt \"{prompt}\"";
        }

        // Build the prompt from task
        String prompt = buildPrompt(task);

        // Replace placeholders
        String command = commandTemplate
                .replace("{prompt}", escapeShell(prompt))
                .replace("{worktree}", worktreePath.toString())
                .replace("{taskId}", String.valueOf(task.getId()))
                .replace("{taskTitle}", escapeShell(task.getTitle()));

        // Build platform-appropriate cd command
        String cdCommand = PlatformUtils.buildCdCommand(worktreePath.toString());
        String separator = PlatformUtils.getCommandSeparator();

        return String.format("%s %s %s", cdCommand, separator, command);
    }

    @Override
    public void prepare(TaskDTO task, Path worktreePath) throws Exception {
        // Ensure worktree exists
        if (!worktreePath.toFile().exists()) {
            throw new IllegalStateException("Worktree does not exist: " + worktreePath);
        }
    }

    @Override
    public void cleanup(Execution execution) {
        // Cleanup is handled by GitService
    }

    @Override
    public ExecutionResult parseResult(int exitCode, String output) {
        if (exitCode == 0) {
            String summary = extractSummary(output);
            return new ExecutionResult(true, "Execution completed successfully", summary);
        } else {
            return new ExecutionResult(false, "Execution failed with exit code " + exitCode, output);
        }
    }

    private String buildPrompt(TaskDTO task) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("**Task:** ").append(task.getTitle()).append("\n");

        if (task.getDescription() != null && !task.getDescription().isEmpty()) {
            prompt.append("**Description:** ").append(task.getDescription()).append("\n");
        }

        prompt.append("\nPlease complete this task. Make the necessary changes and ensure the code works correctly.");

        return prompt.toString();
    }

    private String escapeShell(String s) {
        return PlatformUtils.escapeShell(s);
    }

    private String extractSummary(String output) {
        // Try to extract key information from Claude output
        if (output == null || output.isEmpty()) {
            return "No output";
        }

        // Return last 500 characters as summary
        if (output.length() > 500) {
            return "..." + output.substring(output.length() - 500);
        }
        return output;
    }
}
