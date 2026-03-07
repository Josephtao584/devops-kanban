package com.devops.kanban.service;

import com.devops.kanban.converter.EntityDTOConverter;
import com.devops.kanban.dto.TaskDTO;
import com.devops.kanban.entity.*;
import com.devops.kanban.exception.EntityNotFoundException;
import com.devops.kanban.infrastructure.git.GitOperations;
import com.devops.kanban.infrastructure.util.PlatformUtils;
import com.devops.kanban.repository.AgentRepository;
import com.devops.kanban.repository.ExecutionRepository;
import com.devops.kanban.repository.TaskRepository;
import com.devops.kanban.spi.AgentAdapter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Manages AI agent execution for tasks.
 * Refactored to use AdapterRegistry and EntityDTOConverter.
 */
@Service
@Slf4j
public class AgentExecutionService {

    private final AgentRepository agentRepository;
    private final TaskRepository taskRepository;
    private final ExecutionRepository executionRepository;
    private final GitOperations gitOperations;
    private final AdapterRegistry adapterRegistry;
    private final EntityDTOConverter converter;

    public AgentExecutionService(
            AgentRepository agentRepository,
            TaskRepository taskRepository,
            ExecutionRepository executionRepository,
            GitOperations gitOperations,
            AdapterRegistry adapterRegistry,
            EntityDTOConverter converter) {
        this.agentRepository = agentRepository;
        this.taskRepository = taskRepository;
        this.executionRepository = executionRepository;
        this.gitOperations = gitOperations;
        this.adapterRegistry = adapterRegistry;
        this.converter = converter;
    }

    /**
     * Start execution of a task with an agent
     */
    public Execution startExecution(Long taskId, Long agentId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new EntityNotFoundException("Task", taskId));
        Agent agent = agentRepository.findById(agentId)
                .orElseThrow(() -> new EntityNotFoundException("Agent", agentId));

        if (!agent.isEnabled()) {
            throw new IllegalStateException("Agent is disabled: " + agentId);
        }

        String branch = "task-" + taskId + "-" + System.currentTimeMillis();
        Path worktree = gitOperations.createWorktree(task.getProjectId(), branch);

        Execution execution = Execution.builder()
                .taskId(taskId)
                .agentId(agentId)
                .status(Execution.ExecutionStatus.PENDING)
                .worktreePath(worktree.toString())
                .branch(branch)
                .startedAt(LocalDateTime.now())
                .build();
        execution = executionRepository.save(execution);

        executeAsync(execution, agent, converter.toDTO(task), worktree);

        return execution;
    }

    /**
     * Stop a running execution
     */
    public void stopExecution(Long executionId) {
        Execution execution = executionRepository.findById(executionId)
                .orElseThrow(() -> new EntityNotFoundException("Execution", executionId));

        if (execution.getStatus() == Execution.ExecutionStatus.RUNNING) {
            execution.setStatus(Execution.ExecutionStatus.CANCELLED);
            execution.setCompletedAt(LocalDateTime.now());
            executionRepository.save(execution);

            gitOperations.removeWorktree(Path.of(execution.getWorktreePath()));
        }
    }

    /**
     * Get execution by ID
     */
    public Execution getExecution(Long executionId) {
        return executionRepository.findById(executionId)
                .orElseThrow(() -> new EntityNotFoundException("Execution", executionId));
    }

    /**
     * Get all executions for a task
     */
    public List<Execution> getExecutionsByTaskId(Long taskId) {
        return executionRepository.findByTaskId(taskId);
    }

    @Async
    protected void executeAsync(Execution execution, Agent agent, TaskDTO task, Path worktree) {
        try {
            AgentAdapter adapter = adapterRegistry.getAgentAdapter(agent.getType());

            execution.setStatus(Execution.ExecutionStatus.RUNNING);
            executionRepository.save(execution);

            adapter.prepare(task, worktree);

            String command = adapter.buildCommand(agent, task, worktree);
            log.info("Executing command: {}", command);

            List<String> shellCommand = new ArrayList<>();
            shellCommand.addAll(Arrays.asList(PlatformUtils.getShellPrefix()));
            shellCommand.add(command);
            ProcessBuilder pb = new ProcessBuilder(shellCommand);
            pb.directory(worktree.toFile());
            pb.redirectErrorStream(true);

            Process process = pb.start();

            StringBuilder output = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    output.append(line).append("\n");
                }
            }

            int exitCode = process.waitFor();

            AgentAdapter.ExecutionResult result = adapter.parseResult(exitCode, output.toString());

            execution.setOutput(output.toString());
            execution.setStatus(result.success() ? Execution.ExecutionStatus.SUCCESS : Execution.ExecutionStatus.FAILED);

            if (result.success()) {
                Task taskEntity = taskRepository.findById(execution.getTaskId()).orElse(null);
                if (taskEntity != null) {
                    taskEntity.setStatus(Task.TaskStatus.DONE);
                    taskRepository.save(taskEntity);
                }
            }

        } catch (Exception e) {
            log.error("Execution failed", e);
            execution.setStatus(Execution.ExecutionStatus.FAILED);
            execution.setOutput("Error: " + e.getMessage());
        } finally {
            execution.setCompletedAt(LocalDateTime.now());
            executionRepository.save(execution);

            try {
                gitOperations.removeWorktree(worktree);
            } catch (Exception e) {
                log.warn("Failed to cleanup worktree", e);
            }
        }
    }
}