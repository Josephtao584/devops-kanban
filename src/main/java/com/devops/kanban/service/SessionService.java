package com.devops.kanban.service;

import com.devops.kanban.dto.TaskDTO;
import com.devops.kanban.entity.*;
import com.devops.kanban.repository.AgentRepository;
import com.devops.kanban.repository.ProjectRepository;
import com.devops.kanban.repository.SessionRepository;
import com.devops.kanban.repository.TaskRepository;
import com.devops.kanban.spi.AgentAdapter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Manages AI session lifecycle for tasks.
 */
@Service
@Slf4j
public class SessionService {

    private final SessionRepository sessionRepository;
    private final TaskRepository taskRepository;
    private final AgentRepository agentRepository;
    private final ProjectRepository projectRepository;
    private final GitService gitService;
    private final SessionProcessManager processManager;
    private final Map<Agent.AgentType, AgentAdapter> adapters;

    public SessionService(
            SessionRepository sessionRepository,
            TaskRepository taskRepository,
            AgentRepository agentRepository,
            ProjectRepository projectRepository,
            GitService gitService,
            SessionProcessManager processManager,
            List<AgentAdapter> adapterList) {
        this.sessionRepository = sessionRepository;
        this.taskRepository = taskRepository;
        this.agentRepository = agentRepository;
        this.projectRepository = projectRepository;
        this.gitService = gitService;
        this.processManager = processManager;
        this.adapters = adapterList.stream()
                .collect(Collectors.toMap(AgentAdapter::getType, Function.identity()));
    }

    /**
     * Create a new session for a task
     *
     * @param taskId  the task ID
     * @param agentId the agent ID
     * @return the created session
     */
    public Session createSession(Long taskId, Long agentId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + taskId));
        Agent agent = agentRepository.findById(agentId)
                .orElseThrow(() -> new IllegalArgumentException("Agent not found: " + agentId));

        if (!agent.isEnabled()) {
            throw new IllegalStateException("Agent is disabled: " + agentId);
        }

        // Check for existing active session
        Optional<Session> existingSession = sessionRepository.findActiveByTaskId(taskId);
        if (existingSession.isPresent()) {
            throw new IllegalStateException("Task already has an active session: " + existingSession.get().getId());
        }

        // Get project's local path for worktree creation
        Project project = projectRepository.findById(task.getProjectId())
                .orElseThrow(() -> new IllegalArgumentException("Project not found: " + task.getProjectId()));
        Path localPath = Paths.get(project.getLocalPath());

        // Create worktree for isolation
        String branch = "session-" + taskId + "-" + System.currentTimeMillis();
        Path worktree = gitService.createWorktree(localPath, task.getProjectId(), branch);

        // Create session record
        Session session = Session.builder()
                .taskId(taskId)
                .agentId(agentId)
                .status(Session.SessionStatus.CREATED)
                .worktreePath(worktree.toString())
                .branch(branch)
                .sessionId(UUID.randomUUID().toString())
                .startedAt(LocalDateTime.now())
                .build();

        session = sessionRepository.save(session);
        log.info("Created session {} for task {} with agent {}", session.getId(), taskId, agentId);

        return session;
    }

    /**
     * Start a session's agent process
     *
     * @param sessionId the session ID
     * @return the updated session
     */
    public Session startSession(Long sessionId) {
        Session session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

        if (session.getStatus() != Session.SessionStatus.CREATED &&
            session.getStatus() != Session.SessionStatus.STOPPED) {
            throw new IllegalStateException("Session is not in a startable state: " + session.getStatus());
        }

        Long taskId = session.getTaskId();
        Long agentId = session.getAgentId();

        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + taskId));
        Agent agent = agentRepository.findById(agentId)
                .orElseThrow(() -> new IllegalArgumentException("Agent not found: " + agentId));

        AgentAdapter adapter = getAdapter(agent.getType());
        TaskDTO taskDTO = toDTO(task);

        try {
            // Prepare worktree
            adapter.prepare(taskDTO, Paths.get(session.getWorktreePath()));

            // Build command
            String commandStr = adapter.buildCommand(agent, taskDTO, Paths.get(session.getWorktreePath()));
            log.info("Starting session {} with command: {}", sessionId, commandStr);

            // Parse command for process
            String[] command = parseCommand(commandStr);

            // Start process
            processManager.startProcess(sessionId, command, Paths.get(session.getWorktreePath()));

            // Initialize output buffer from storage (for resuming)
            processManager.initializeOutput(sessionId);

            // Update session status
            session.setStatus(Session.SessionStatus.RUNNING);
            session.setLastHeartbeat(LocalDateTime.now());
            session = sessionRepository.save(session);

            // Start heartbeat monitor
            startHeartbeatMonitor(sessionId);

        } catch (Exception e) {
            log.error("Failed to start session {}", sessionId, e);
            session.setStatus(Session.SessionStatus.ERROR);
            session.setStoppedAt(LocalDateTime.now());
            sessionRepository.save(session);
            throw new RuntimeException("Failed to start session", e);
        }

        return session;
    }

    /**
     * Stop a running session
     *
     * @param sessionId the session ID
     * @return the updated session
     */
    public Session stopSession(Long sessionId) {
        Session session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

        if (session.getStatus() != Session.SessionStatus.RUNNING &&
            session.getStatus() != Session.SessionStatus.IDLE) {
            throw new IllegalStateException("Session is not running: " + session.getStatus());
        }

        // Get final output and stop the process
        String finalOutput = processManager.getOutput(sessionId);
        processManager.stopProcess(sessionId);

        // Update session status and output
        session.setStatus(Session.SessionStatus.STOPPED);
        session.setStoppedAt(LocalDateTime.now());
        session.setOutput(finalOutput);
        session = sessionRepository.save(session);

        log.info("Stopped session {}", sessionId);
        return session;
    }

    /**
     * Send input to a running session
     *
     * @param sessionId the session ID
     * @param input     the input to send
     * @return true if input was sent successfully
     */
    public boolean sendInput(Long sessionId, String input) {
        Session session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

        if (session.getStatus() != Session.SessionStatus.RUNNING &&
            session.getStatus() != Session.SessionStatus.IDLE) {
            throw new IllegalStateException("Session is not accepting input: " + session.getStatus());
        }

        return processManager.sendInput(sessionId, input);
    }

    /**
     * Get session by ID
     */
    public Optional<Session> getSession(Long sessionId) {
        return sessionRepository.findById(sessionId);
    }

    /**
     * Get session by WebSocket session ID
     */
    public Optional<Session> getSessionBySessionId(String wsSessionId) {
        return sessionRepository.findBySessionId(wsSessionId);
    }

    /**
     * Get active session for a task
     */
    public Optional<Session> getActiveSessionByTaskId(Long taskId) {
        return sessionRepository.findActiveByTaskId(taskId);
    }

    /**
     * Get all sessions for a task
     */
    public List<Session> getSessionsByTaskId(Long taskId) {
        return sessionRepository.findByTaskId(taskId);
    }

    /**
     * Get all sessions for a task with output loaded
     */
    public List<Session> getSessionsWithOutputByTaskId(Long taskId) {
        List<Session> sessions = sessionRepository.findByTaskId(taskId);
        // Output is already stored in session entity, no need to load separately
        return sessions;
    }

    /**
     * Get session output
     */
    public String getSessionOutput(Long sessionId) {
        // First check in-memory output
        String output = processManager.getOutput(sessionId);
        if (output != null && !output.isEmpty()) {
            return output;
        }
        // Then check storage
        return sessionRepository.findById(sessionId)
                .map(session -> session.getOutput() != null ? session.getOutput() : "")
                .orElse("");
    }

    /**
     * Delete a session
     */
    public void deleteSession(Long sessionId) {
        Session session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

        // Stop if running
        if (session.getStatus() == Session.SessionStatus.RUNNING ||
            session.getStatus() == Session.SessionStatus.IDLE) {
            processManager.stopProcess(sessionId);
        }

        // Cleanup worktree
        try {
            gitService.removeWorktree(Paths.get(session.getWorktreePath()));
        } catch (Exception e) {
            log.warn("Failed to cleanup worktree for session {}", sessionId, e);
        }

        // Cleanup process resources
        processManager.cleanup(sessionId);

        // Delete session
        sessionRepository.delete(sessionId);
        log.info("Deleted session {}", sessionId);
    }

    /**
     * Update session status based on process state
     */
    public void updateSessionStatus(Long sessionId, Session.SessionStatus status) {
        sessionRepository.findById(sessionId).ifPresent(session -> {
            session.setStatus(status);
            session.setLastHeartbeat(LocalDateTime.now());
            sessionRepository.save(session);
        });
    }

    private AgentAdapter getAdapter(Agent.AgentType type) {
        AgentAdapter adapter = adapters.get(type);
        if (adapter == null) {
            throw new IllegalArgumentException("No adapter found for agent type: " + type);
        }
        return adapter;
    }

    private String[] parseCommand(String commandStr) {
        // Simple parsing - split on spaces but respect quoted strings
        // For complex cases, consider using a proper shell parser
        if (commandStr.startsWith("cd") && commandStr.contains("&&")) {
            // Handle "cd path && command" format
            String[] parts = commandStr.split("&&", 2);
            String cdPart = parts[0].trim();
            String cmdPart = parts.length > 1 ? parts[1].trim() : "";

            // Extract directory from cd command
            String dir = cdPart.substring(2).trim().replace("\"", "");

            // Build command array
            return new String[]{"bash", "-c", cmdPart};
        }

        // Default: use bash -c
        return new String[]{"bash", "-c", commandStr};
    }

    private TaskDTO toDTO(Task task) {
        return TaskDTO.builder()
                .id(task.getId())
                .projectId(task.getProjectId())
                .title(task.getTitle())
                .description(task.getDescription())
                .status(task.getStatus().name())
                .priority(task.getPriority().name())
                .assignee(task.getAssignee())
                .sourceId(task.getSourceId())
                .externalId(task.getExternalId())
                .syncedAt(task.getSyncedAt())
                .createdAt(task.getCreatedAt())
                .updatedAt(task.getUpdatedAt())
                .build();
    }

    private void startHeartbeatMonitor(Long sessionId) {
        // Simple heartbeat - just update lastHeartbeat periodically
        Thread heartbeatThread = new Thread(() -> {
            while (processManager.isProcessAlive(sessionId)) {
                try {
                    Thread.sleep(5000); // 5 seconds
                    sessionRepository.findById(sessionId).ifPresent(session -> {
                        session.setLastHeartbeat(LocalDateTime.now());
                        sessionRepository.save(session);
                    });
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }

            // Process ended - update status
            int exitCode = processManager.getExitCode(sessionId);
            sessionRepository.findById(sessionId).ifPresent(session -> {
                if (exitCode == 0) {
                    session.setStatus(Session.SessionStatus.STOPPED);
                } else {
                    session.setStatus(Session.SessionStatus.ERROR);
                }
                session.setStoppedAt(LocalDateTime.now());
                sessionRepository.save(session);
            });
        }, "session-heartbeat-" + sessionId);
        heartbeatThread.setDaemon(true);
        heartbeatThread.start();
    }
}
