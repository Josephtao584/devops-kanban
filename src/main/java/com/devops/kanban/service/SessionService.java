package com.devops.kanban.service;

import com.devops.kanban.config.BridgeConfig;
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
    private final BridgeClient bridgeClient;
    private final BridgeConfig bridgeConfig;
    private final Map<Agent.AgentType, AgentAdapter> adapters;

    public SessionService(
            SessionRepository sessionRepository,
            TaskRepository taskRepository,
            AgentRepository agentRepository,
            ProjectRepository projectRepository,
            GitService gitService,
            SessionProcessManager processManager,
            BridgeClient bridgeClient,
            BridgeConfig bridgeConfig,
            List<AgentAdapter> adapterList) {
        this.sessionRepository = sessionRepository;
        this.taskRepository = taskRepository;
        this.agentRepository = agentRepository;
        this.projectRepository = projectRepository;
        this.gitService = gitService;
        this.processManager = processManager;
        this.bridgeClient = bridgeClient;
        this.bridgeConfig = bridgeConfig;
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

        log.info("[Session] Creating session | TaskId: {} | AgentId: {} | ProjectId: {} | Task: '{}'",
            taskId, agentId, task.getProjectId(), task.getTitle());

        if (!agent.isEnabled()) {
            log.warn("[Session] Agent is disabled | AgentId: {} | AgentName: {}", agentId, agent.getName());
            throw new IllegalStateException("Agent is disabled: " + agentId);
        }

        // Check for existing active session
        Optional<Session> existingSession = sessionRepository.findActiveByTaskId(taskId);
        if (existingSession.isPresent()) {
            log.warn("[Session] Task already has active session | TaskId: {} | ExistingSessionId: {}",
                taskId, existingSession.get().getId());
            throw new IllegalStateException("Task already has an active session: " + existingSession.get().getId());
        }

        // Get project's local path for worktree creation
        Project project = projectRepository.findById(task.getProjectId())
                .orElseThrow(() -> new IllegalArgumentException("Project not found: " + task.getProjectId()));

        if (project.getLocalPath() == null || project.getLocalPath().isBlank()) {
            log.error("[Session] Project missing localPath | ProjectId: {} | ProjectName: {}",
                task.getProjectId(), project.getName());
            throw new IllegalStateException(
                "Project '" + project.getName() + "' does not have a local path configured. " +
                "Please set the local repository path in project settings.");
        }
        Path localPath = Paths.get(project.getLocalPath());

        // Create worktree for isolation
        String branch = "session-" + taskId + "-" + System.currentTimeMillis();
        log.debug("[Session] Creating worktree | LocalPath: {} | Branch: {}", localPath, branch);
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
        log.info("[Session-{}] Created successfully | Worktree: {} | Branch: {} | UUID: {} | AgentType: {}",
            session.getId(), session.getWorktreePath(), session.getBranch(), session.getSessionId(), agent.getType());

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

        log.info("[Session-{}] Starting session | CurrentStatus: {} | TaskId: {} | AgentId: {}",
            sessionId, session.getStatus(), session.getTaskId(), session.getAgentId());

        if (session.getStatus() != Session.SessionStatus.CREATED &&
            session.getStatus() != Session.SessionStatus.STOPPED) {
            log.warn("[Session-{}] Cannot start - invalid state: {}", sessionId, session.getStatus());
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
            log.debug("[Session-{}] Preparing worktree at: {}", sessionId, session.getWorktreePath());
            adapter.prepare(taskDTO, Paths.get(session.getWorktreePath()));

            // Build command
            String commandStr = adapter.buildCommand(agent, taskDTO, Paths.get(session.getWorktreePath()));
            log.info("[Session-{}] Command built | AgentType: {} | Command: {}", sessionId, agent.getType(), commandStr);

            // Extract initial prompt (will be sent via stdin for stream-json mode)
            String initialPrompt = extractPrompt(commandStr);

            // Check if bridge mode is enabled and healthy
            boolean useBridge = bridgeConfig.isEnabled() && bridgeClient.isHealthy();

            if (useBridge) {
                // Use Node.js bridge for Claude CLI
                log.info("[Session-{}] Using Node.js bridge mode | Bridge URL: {}",
                    sessionId, bridgeConfig.getBaseUrl());

                startSessionViaBridge(session, initialPrompt);
            } else {
                // Fallback to PTY mode
                log.info("[Session-{}] Using PTY mode (bridge disabled or unhealthy)", sessionId);

                startSessionViaPty(session, commandStr, initialPrompt);
            }

            // Update session status
            session.setStatus(Session.SessionStatus.RUNNING);
            session.setLastHeartbeat(LocalDateTime.now());
            session = sessionRepository.save(session);

            log.info("[Session-{}] Session started successfully | Status: {} | Worktree: {} | Mode: {}",
                sessionId, session.getStatus(), session.getWorktreePath(), useBridge ? "bridge" : "pty");

            // Start heartbeat monitor
            startHeartbeatMonitor(sessionId);

        } catch (Exception e) {
            log.error("[Session-{}] Failed to start session | Error: {} | Worktree: {}",
                sessionId, e.getMessage(), session.getWorktreePath(), e);
            session.setStatus(Session.SessionStatus.ERROR);
            session.setStoppedAt(LocalDateTime.now());
            sessionRepository.save(session);
            throw new RuntimeException("Failed to start session", e);
        }

        return session;
    }

    /**
     * Start session via Node.js bridge
     */
    private void startSessionViaBridge(Session session, String initialPrompt) {
        String bridgeSessionId = session.getSessionId();
        String workDir = session.getWorktreePath();

        log.info("[Session-{}] Starting via bridge | BridgeSessionId: {} | WorkDir: {}",
            session.getId(), bridgeSessionId, workDir);

        BridgeClient.BridgeSession bridgeSession = bridgeClient.startSession(bridgeSessionId, workDir, initialPrompt);

        log.info("[Session-{}] Bridge session started | PID: {} | Status: {}",
            session.getId(), bridgeSession.getPid(), bridgeSession.getStatus());

        // Start WebSocket connection to Bridge,接收实时输出
        bridgeWebSocketClient.connectToBridge(bridgeSessionId, session.getId());

        log.info("[Session-{}] WebSocket connection to Bridge initiated | BridgeSessionId: {}",
            session.getId(), bridgeSessionId);
    }

    /**
     * Start session via PTY (fallback mode)
     */
    private void startSessionViaPty(Session session, String commandStr, String initialPrompt) {
        // Parse command for process
        String[] command = parseCommand(commandStr);

        // Start process
        processManager.startProcess(session.getId(), command, Paths.get(session.getWorktreePath()));

        // Initialize output buffer from storage (for resuming)
        processManager.initializeOutput(session.getId());

        // Send initial prompt via stdin (for stream-json mode)
        if (initialPrompt != null && !initialPrompt.isEmpty()) {
            log.info("[Session-{}] Sending initial prompt via stdin", session.getId());
            processManager.sendInput(session.getId(), initialPrompt);
        }
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

        log.info("[Session-{}] Stopping session | CurrentStatus: {} | TaskId: {}",
            sessionId, session.getStatus(), session.getTaskId());

        if (session.getStatus() != Session.SessionStatus.RUNNING &&
            session.getStatus() != Session.SessionStatus.IDLE) {
            log.warn("[Session-{}] Cannot stop - session not running: {}", sessionId, session.getStatus());
            throw new IllegalStateException("Session is not running: " + session.getStatus());
        }

        // Get final output
        String finalOutput = processManager.getOutput(sessionId);
        log.debug("[Session-{}] Final output length: {} chars", sessionId, finalOutput != null ? finalOutput.length() : 0);

        // Check if session was started via bridge
        boolean useBridge = bridgeConfig.isEnabled() &&
            bridgeClient.getSession(session.getSessionId()) != null;

        if (useBridge) {
            // Stop via bridge
            log.info("[Session-{}] Stopping via bridge | BridgeSessionId: {}", sessionId, session.getSessionId());
            bridgeClient.stopSession(session.getSessionId());
            // Close WebSocket connection to bridge
            bridgeWebSocketClient.disconnectFromBridge(session.getSessionId());

        if (useBridge) {
            // Stop via bridge
            log.info("[Session-{}] Stopping via bridge | BridgeSessionId: {}", sessionId, session.getSessionId());
            bridgeClient.stopSession(session.getSessionId());
        } else {
            // Stop via PTY
            processManager.stopProcess(sessionId);
        }

        // Update session status and output
        session.setStatus(Session.SessionStatus.STOPPED);
        session.setStoppedAt(LocalDateTime.now());
        session.setOutput(finalOutput);
        session = sessionRepository.save(session);

        log.info("[Session-{}] Session stopped successfully | Status: {} | OutputLength: {} | Mode: {}",
            sessionId, session.getStatus(), finalOutput != null ? finalOutput.length() : 0,
            useBridge ? "bridge" : "pty");
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
            log.warn("[Session-{}] Cannot send input - session not running: {}", sessionId, session.getStatus());
            throw new IllegalStateException("Session is not accepting input: " + session.getStatus());
        }

        log.debug("[Session-{}] Sending input: {}", sessionId, input.length() > 50 ? input.substring(0, 50) + "..." : input);

        // Check if session was started via bridge
        boolean useBridge = bridgeConfig.isEnabled() &&
            bridgeWebSocketClient.isConnected(session.getSessionId());

        if (useBridge) {
            // Use BridgeWebSocketClient to send input
            log.debug("[Session-{}] Bridge mode - sending input via BridgeWebSocketClient", sessionId);
            return bridgeWebSocketClient.sendInput(session.getSessionId(), input);
        } else {
            log.warn("[Session-{}] PTY mode - cannot send input: {} | sessionId);
            return processManager.sendInput(sessionId, input);
        }
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

        log.info("[Session-{}] Deleting session | Status: {} | TaskId: {} | Worktree: {}",
            sessionId, session.getStatus(), session.getTaskId(), session.getWorktreePath());

        // Stop if running
        if (session.getStatus() == Session.SessionStatus.RUNNING ||
            session.getStatus() == Session.SessionStatus.IDLE) {
            log.debug("[Session-{}] Stopping running process before deletion", sessionId);

            // Check if session was started via bridge
            boolean useBridge = bridgeConfig.isEnabled() &&
                bridgeClient.getSession(session.getSessionId()) != null;

            if (useBridge) {
                bridgeClient.stopSession(session.getSessionId());
            } else {
                processManager.stopProcess(sessionId);
            }
        }

        // Cleanup worktree
        try {
            log.debug("[Session-{}] Removing worktree: {}", sessionId, session.getWorktreePath());
            gitService.removeWorktree(Paths.get(session.getWorktreePath()));
        } catch (Exception e) {
            log.warn("[Session-{}] Failed to cleanup worktree: {} | Error: {}",
                sessionId, session.getWorktreePath(), e.getMessage());
        }

        // Cleanup process resources
        processManager.cleanup(sessionId);

        // Cleanup bridge session tracking and WebSocket connection
        bridgeClient.removeSession(session.getSessionId());
        bridgeWebSocketClient.disconnectFromBridge(session.getSessionId());

        // Delete session
        sessionRepository.delete(sessionId);
        log.info("[Session-{}] Session deleted successfully", sessionId);
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
        // Parse command string for PTY process execution
        // Working directory is already set by PtyProcessBuilder, so we don't need cd

        String cmdPart = commandStr;
        if (commandStr.startsWith("cd") && commandStr.contains("&&")) {
            // Handle "cd path && command" format - extract just the command part
            String[] parts = commandStr.split("&&", 2);
            cmdPart = parts.length > 1 ? parts[1].trim() : "";
        }

        boolean isWindows = System.getProperty("os.name").toLowerCase().contains("windows");

        // Check if this is a claude command
        boolean isClaudeCommand = cmdPart.equals("claude") || cmdPart.startsWith("claude ");

        if (isWindows) {
            if (isClaudeCommand) {
                // Phase 8: 添加 --output-format stream-json 禁用 Ink TUI
                // stream-json 输出 JSON 流，避免 Ink 框架的 TUI 渲染问题
                String claudeCliPath = "C:\\Users\\Administrator\\AppData\\Roaming\\npm\\node_modules\\@anthropic-ai\\claude-code\\cli.js";
                return new String[]{"node.exe", claudeCliPath, "--output-format", "stream-json"};
            } else {
                // For non-claude commands, use cmd.exe as before
                return new String[]{"cmd.exe", "/c", cmdPart};
            }
        } else {
            // On Unix, use bash -l (login shell) to load user environment
            return new String[]{"bash", "-lc", cmdPart};
        }
    }

    /**
     * Extract initial prompt from command string (for sending via stdin)
     */
    private String extractPrompt(String commandStr) {
        String cmdPart = commandStr;
        if (commandStr.startsWith("cd") && commandStr.contains("&&")) {
            String[] parts = commandStr.split("&&", 2);
            cmdPart = parts.length > 1 ? parts[1].trim() : "";
        }

        // Extract prompt from --prompt "..."
        java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("--prompt\\s+\"([^\"]*)\"")
                .matcher(cmdPart);
        if (matcher.find()) {
            return matcher.group(1);
        }
        return null;
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
        log.debug("[Session-{}] Starting heartbeat monitor thread", sessionId);

        // Simple heartbeat - just update lastHeartbeat periodically
        Thread heartbeatThread = new Thread(() -> {
            Thread.currentThread().setName("session-" + sessionId + "-heartbeat");
            log.debug("[Session-{}] Heartbeat monitor started | Thread: {}",
                sessionId, Thread.currentThread().getName());

            // Get session to check if using bridge
            Optional<Session> sessionOpt = sessionRepository.findById(sessionId);
            boolean useBridge = sessionOpt.isPresent() &&
                bridgeConfig.isEnabled() &&
                bridgeClient.getSession(sessionOpt.get().getSessionId()) != null;

            if (useBridge) {
                // Bridge mode - poll bridge for session status
                while (true) {
                    try {
                        Thread.sleep(5000); // 5 seconds

                        BridgeClient.BridgeSession bridgeSession = bridgeClient.getSession(
                            sessionOpt.get().getSessionId());

                        sessionRepository.findById(sessionId).ifPresent(session -> {
                            session.setLastHeartbeat(LocalDateTime.now());
                            sessionRepository.save(session);
                            log.trace("[Session-{}] Heartbeat updated (bridge mode)", sessionId);

                            // Check if bridge session ended
                            if (bridgeSession == null ||
                                "COMPLETED".equals(bridgeSession.getStatus()) ||
                                "ERROR".equals(bridgeSession.getStatus()) ||
                                "STOPPED".equals(bridgeSession.getStatus())) {

                                log.info("[Session-{}] Bridge session ended | Status: {}",
                                    sessionId, bridgeSession != null ? bridgeSession.getStatus() : "null");

                                if (bridgeSession != null && "ERROR".equals(bridgeSession.getStatus())) {
                                    session.setStatus(Session.SessionStatus.ERROR);
                                } else {
                                    session.setStatus(Session.SessionStatus.STOPPED);
                                }
                                session.setStoppedAt(LocalDateTime.now());
                                sessionRepository.save(session);
                                return; // Exit the loop
                            }
                        });

                        // Check if session was stopped
                        Session currentSession = sessionRepository.findById(sessionId).orElse(null);
                        if (currentSession == null ||
                            currentSession.getStatus() == Session.SessionStatus.STOPPED ||
                            currentSession.getStatus() == Session.SessionStatus.ERROR) {
                            break;
                        }

                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        log.debug("[Session-{}] Heartbeat monitor interrupted", sessionId);
                        break;
                    }
                }
            } else {
                // PTY mode - check process status
                while (processManager.isProcessAlive(sessionId)) {
                    try {
                        Thread.sleep(5000); // 5 seconds
                        sessionRepository.findById(sessionId).ifPresent(session -> {
                            session.setLastHeartbeat(LocalDateTime.now());
                            sessionRepository.save(session);
                            log.trace("[Session-{}] Heartbeat updated", sessionId);
                        });
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        log.debug("[Session-{}] Heartbeat monitor interrupted", sessionId);
                        break;
                    }
                }

                // Process ended - update status
                int exitCode = processManager.getExitCode(sessionId);
                log.info("[Session-{}] Heartbeat monitor: process ended | ExitCode: {}", sessionId, exitCode);

                sessionRepository.findById(sessionId).ifPresent(session -> {
                    if (exitCode == 0) {
                        session.setStatus(Session.SessionStatus.STOPPED);
                    } else {
                        session.setStatus(Session.SessionStatus.ERROR);
                    }
                    session.setStoppedAt(LocalDateTime.now());
                    sessionRepository.save(session);
                    log.info("[Session-{}] Final status updated | Status: {} | ExitCode: {}",
                        sessionId, session.getStatus(), exitCode);
                });
            }
        }, "session-" + sessionId + "-heartbeat");
        heartbeatThread.setDaemon(true);
        heartbeatThread.start();
    }
}
