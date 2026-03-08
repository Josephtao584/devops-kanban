package com.devops.kanban.service;

import com.devops.kanban.converter.EntityDTOConverter;
import com.devops.kanban.dto.ChatMessageDTO;
import com.devops.kanban.dto.TaskDTO;
import com.devops.kanban.entity.*;
import com.devops.kanban.exception.EntityNotFoundException;
import com.devops.kanban.infrastructure.git.GitOperations;
import com.devops.kanban.infrastructure.process.ProcessExecutor;
import com.devops.kanban.infrastructure.util.PlatformUtils;
import com.devops.kanban.repository.AgentRepository;
import com.devops.kanban.repository.ProjectRepository;
import com.devops.kanban.repository.SessionRepository;
import com.devops.kanban.repository.TaskRepository;
import com.devops.kanban.spi.AgentAdapter;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Manages AI session lifecycle for tasks.
 * Refactored to use shared components for adapter lookup, DTO conversion, and heartbeat monitoring.
 */
@Service
@Slf4j
public class SessionService {

    private final SessionRepository sessionRepository;
    private final TaskRepository taskRepository;
    private final AgentRepository agentRepository;
    private final ProjectRepository projectRepository;
    private final GitOperations gitOperations;
    private final ProcessExecutor processExecutor;
    private final AdapterRegistry adapterRegistry;
    private final EntityDTOConverter converter;
    private final PromptBuilder promptBuilder;
    private final HeartbeatMonitor heartbeatMonitor;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public SessionService(
            SessionRepository sessionRepository,
            TaskRepository taskRepository,
            AgentRepository agentRepository,
            ProjectRepository projectRepository,
            GitOperations gitOperations,
            ProcessExecutor processExecutor,
            AdapterRegistry adapterRegistry,
            EntityDTOConverter converter,
            PromptBuilder promptBuilder,
            HeartbeatMonitor heartbeatMonitor) {
        this.sessionRepository = sessionRepository;
        this.taskRepository = taskRepository;
        this.agentRepository = agentRepository;
        this.projectRepository = projectRepository;
        this.gitOperations = gitOperations;
        this.processExecutor = processExecutor;
        this.adapterRegistry = adapterRegistry;
        this.converter = converter;
        this.promptBuilder = promptBuilder;
        this.heartbeatMonitor = heartbeatMonitor;
    }

    /**
     * Parse messages JSON from session entity
     */
    private List<ChatMessageDTO> parseMessages(Session session) {
        if (session.getMessages() == null || session.getMessages().isEmpty()) {
            return new ArrayList<>();
        }
        try {
            return objectMapper.readValue(session.getMessages(), new TypeReference<List<ChatMessageDTO>>() {});
        } catch (Exception e) {
            log.warn("[Session-{}] Failed to parse messages: {}", session.getId(), e.getMessage());
            return new ArrayList<>();
        }
    }

    /**
     * Serialize messages to JSON string
     */
    private String serializeMessages(List<ChatMessageDTO> messages) {
        try {
            return objectMapper.writeValueAsString(messages);
        } catch (Exception e) {
            log.warn("Failed to serialize messages: {}", e.getMessage());
            return "[]";
        }
    }

    /**
     * Add a message to session history
     */
    private Session addMessage(Session session, String role, String content) {
        // Debug: log user/assistant input
        if ("user".equals(role)) {
            log.debug("[Session-{}] USER input ({} chars): {}", session.getId(),
                content.length(), content.length() > 500 ? content.substring(0, 500) + "..." : content);
        }

        List<ChatMessageDTO> messages = parseMessages(session);
        ChatMessageDTO message = ChatMessageDTO.builder()
                .id(String.valueOf(System.currentTimeMillis()))
                .role(role)
                .content(content)
                .timestamp(LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME))
                .build();
        messages.add(message);
        session.setMessages(serializeMessages(messages));
        return sessionRepository.save(session);
    }

    /**
     * Create a new session for a task
     */
    public Session createSession(Long taskId, Long agentId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new EntityNotFoundException("Task", taskId));
        Agent agent = agentRepository.findById(agentId)
                .orElseThrow(() -> new EntityNotFoundException("Agent", agentId));

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

        // Get project's local path
        Project project = projectRepository.findById(task.getProjectId())
                .orElseThrow(() -> new EntityNotFoundException("Project", task.getProjectId()));

        if (project.getLocalPath() == null || project.getLocalPath().isBlank()) {
            log.error("[Session] Project missing localPath | ProjectId: {} | ProjectName: {}",
                task.getProjectId(), project.getName());
            throw new IllegalStateException(
                "Project '" + project.getName() + "' does not have a local path configured.");
        }
        Path localPath = Paths.get(project.getLocalPath());

        // Check if the localPath is a Git repository
        boolean isGitRepo = gitOperations.isGitRepository(localPath);
        log.info("[Session] Project {} | LocalPath: {} | IsGitRepo: {}",
            project.getName(), localPath, isGitRepo);

        // Determine worktree path - first check task, then fall back to existing sessions
        String worktreePath;
        String branch;

        // Priority 1: Check if task already has worktreePath
        if (task.getWorktreePath() != null && !task.getWorktreePath().isBlank()) {
            worktreePath = task.getWorktreePath();
            branch = task.getBranch();
            log.info("[Session] Reusing worktree from task {} | Worktree: {} | Branch: {}",
                taskId, worktreePath, branch);
        } else {
            // Priority 2: Check for existing worktree from any previous session
            List<Session> allTaskSessions = sessionRepository.findByTaskId(taskId);
            Optional<Session> sessionWithWorktree = allTaskSessions.stream()
                .filter(s -> s.getWorktreePath() != null && !s.getWorktreePath().isBlank())
                .findFirst();

            if (sessionWithWorktree.isPresent()) {
                // Reuse existing worktree from session
                Session priorSession = sessionWithWorktree.get();
                worktreePath = priorSession.getWorktreePath();
                branch = priorSession.getBranch();
                log.info("[Session] Reusing worktree from prior session for task {} | Worktree: {} | Branch: {}",
                    taskId, worktreePath, branch);
            } else if (isGitRepo) {
                // Priority 3: Create new worktree for Git project isolation
                branch = "task-" + taskId + "-" + System.currentTimeMillis();
                log.debug("[Session] Creating new worktree | LocalPath: {} | Branch: {}", localPath, branch);
                Path worktree = gitOperations.createWorktree(localPath, task.getProjectId(), branch);
                worktreePath = worktree.toString();
                log.info("[Session] Created new worktree for task {} | Worktree: {}", taskId, worktreePath);
            } else {
                // For non-Git project, use localPath directly (no worktree creation)
                branch = null;
                worktreePath = localPath.toString();
                log.info("[Session] Using localPath directly for non-Git project {} | Worktree: {}",
                    taskId, worktreePath);
            }

            // Save worktree info to task for future reuse (only if task doesn't have it yet)
            if (task.getWorktreePath() == null || task.getWorktreePath().isBlank()) {
                task.setWorktreePath(worktreePath);
                task.setBranch(branch);
                taskRepository.save(task);
                log.info("[Session] Saved worktree info to task {} | Worktree: {} | Branch: {}",
                    taskId, worktreePath, branch);
            }
        }

        // Generate initialPrompt at creation time so frontend can display it
        TaskDTO taskDTO = converter.toDTO(task);
        String initialPrompt = promptBuilder.buildInitialPrompt(taskDTO);

        // Create session record
        Session session = Session.builder()
                .taskId(taskId)
                .agentId(agentId)
                .status(Session.SessionStatus.CREATED)
                .worktreePath(worktreePath)
                .branch(branch)
                .sessionId(UUID.randomUUID().toString())
                .startedAt(LocalDateTime.now())
                .initialPrompt(initialPrompt)
                .build();

        session = sessionRepository.save(session);
        log.info("[Session-{}] Created successfully | Worktree: {} | Branch: {} | UUID: {} | AgentType: {}",
            session.getId(), session.getWorktreePath(), session.getBranch(), session.getSessionId(), agent.getType());

        return session;
    }

    /**
     * Start a session's agent process
     */
    public Session startSession(Long sessionId) {
        Session session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new EntityNotFoundException("Session", sessionId));

        log.info("[Session-{}] Starting session | CurrentStatus: {} | TaskId: {} | AgentId: {}",
            sessionId, session.getStatus(), session.getTaskId(), session.getAgentId());

        if (session.getStatus() != Session.SessionStatus.CREATED &&
            session.getStatus() != Session.SessionStatus.STOPPED) {
            log.warn("[Session-{}] Cannot start - invalid state: {}", sessionId, session.getStatus());
            throw new IllegalStateException("Session is not in a startable state: " + session.getStatus());
        }

        if (processExecutor.isRunning(sessionId)) {
            log.warn("[Session-{}] Cannot start - process already running", sessionId);
            throw new IllegalStateException("Session process is already running");
        }

        Long taskId = session.getTaskId();
        Long agentId = session.getAgentId();

        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new EntityNotFoundException("Task", taskId));
        Agent agent = agentRepository.findById(agentId)
                .orElseThrow(() -> new EntityNotFoundException("Agent", agentId));

        AgentAdapter adapter = adapterRegistry.getAgentAdapter(agent.getType());
        TaskDTO taskDTO = converter.toDTO(task);

        try {
            log.debug("[Session-{}] Preparing worktree at: {}", sessionId, session.getWorktreePath());
            adapter.prepare(taskDTO, Paths.get(session.getWorktreePath()));

            String claudeCliPath = getClaudeCliPath(adapter);
            log.info("[Session-{}] Starting Claude Code Executor | CLI: {} | WorkDir: {}",
                sessionId, claudeCliPath, session.getWorktreePath());

            String initialPrompt = promptBuilder.buildInitialPrompt(taskDTO);

            session.setInitialPrompt(initialPrompt);
            session = sessionRepository.save(session);

            log.info("[Session-{}] Starting fresh session (no Claude session ID yet)", sessionId);

            boolean started = processExecutor.start(
                sessionId,
                claudeCliPath,
                Paths.get(session.getWorktreePath()),
                initialPrompt,
                null
            );

            if (!started) {
                throw new RuntimeException("Failed to spawn Claude Code process");
            }

            // Add initial user message to history
            session = addMessage(session, "user", initialPrompt);

            session.setStatus(Session.SessionStatus.RUNNING);
            session.setLastHeartbeat(LocalDateTime.now());
            session = sessionRepository.save(session);

            log.info("[Session-{}] Session started successfully | Status: {} | Worktree: {}",
                sessionId, session.getStatus(), session.getWorktreePath());

            heartbeatMonitor.startMonitoring(sessionId);

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
     * Get Claude CLI path from adapter or use default
     */
    private String getClaudeCliPath(AgentAdapter adapter) {
        if (adapter instanceof com.devops.kanban.adapter.agent.ClaudeCodeAdapter) {
            com.devops.kanban.adapter.agent.ClaudeCodeAdapter claudeAdapter =
                (com.devops.kanban.adapter.agent.ClaudeCodeAdapter) adapter;
            return claudeAdapter.getClaudeCliPath();
        }
        if (PlatformUtils.isWindows()) {
            String appData = System.getenv("APPDATA");
            if (appData != null) {
                return appData + "\\npm\\node_modules\\@anthropic-ai\\claude-code\\cli.js";
            } else {
                return PlatformUtils.getHomeDirectory() + "\\AppData\\Roaming\\npm\\node_modules\\@anthropic-ai\\claude-code\\cli.js";
            }
        } else {
            return "claude";
        }
    }

    /**
     * Stop a running session
     */
    public Session stopSession(Long sessionId) {
        Session session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new EntityNotFoundException("Session", sessionId));

        log.info("[Session-{}] Stopping session | CurrentStatus: {} | TaskId: {}",
            sessionId, session.getStatus(), session.getTaskId());

        if (session.getStatus() != Session.SessionStatus.RUNNING &&
            session.getStatus() != Session.SessionStatus.IDLE) {
            log.warn("[Session-{}] Cannot stop - session not running: {}", sessionId, session.getStatus());
            throw new IllegalStateException("Session is not running: " + session.getStatus());
        }

        String finalOutput = processExecutor.getOutput(sessionId);
        log.debug("[Session-{}] Final output length: {} chars", sessionId, finalOutput != null ? finalOutput.length() : 0);

        processExecutor.stop(sessionId);
        heartbeatMonitor.stopMonitoring(sessionId);

        session.setStatus(Session.SessionStatus.STOPPED);
        session.setStoppedAt(LocalDateTime.now());
        session.setOutput(finalOutput);
        session = sessionRepository.save(session);

        // Note: We don't add assistant message here anymore to avoid duplicates.
        // Messages are added in real-time via WebSocket or during process exit.
        log.info("[Session-{}] Session stopped successfully | Status: {} | OutputLength: {}",
            sessionId, session.getStatus(), finalOutput != null ? finalOutput.length() : 0);
        return session;
    }

    /**
     * Send input to a running session
     */
    public boolean sendInput(Long sessionId, String input) {
        Session session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new EntityNotFoundException("Session", sessionId));

        // If session is CREATED, start it first
        if (session.getStatus() == Session.SessionStatus.CREATED) {
            log.info("[Session-{}] Session not started yet, starting first", sessionId);
            startSession(sessionId);
            // After starting, the input will be handled when process is ready
            // For now, return true - the initial prompt was already sent during startSession
            return true;
        }

        // Add user message to history
        addMessage(session, "user", input);
        // Reload session after addMessage
        session = sessionRepository.findById(sessionId).orElseThrow();

        String claudeSessionId = session.getClaudeSessionId();

        // Print mode (-p) does NOT accept stdin input. We must always use --resume.
        // If process is running, we need to wait for it to finish first.
        if (processExecutor.isRunning(sessionId)) {
            log.info("[Session-{}] Process still running in print mode, waiting for completion...", sessionId);
            // Wait for process to complete (with timeout)
            boolean waited = processExecutor.waitForCompletion(sessionId, 30);
            if (!waited) {
                log.warn("[Session-{}] Process did not complete in time, stopping it", sessionId);
                processExecutor.stop(sessionId);
                heartbeatMonitor.stopMonitoring(sessionId);
            }
        }

        // Now process should be stopped, use --resume to continue
        if (claudeSessionId != null && !claudeSessionId.isEmpty()) {
            if (session.getStatus() == Session.SessionStatus.RUNNING) {
                session.setStatus(Session.SessionStatus.STOPPED);
                session = sessionRepository.save(session);
            }
            log.info("[Session-{}] Resuming session with new input", sessionId);
            return resumeSession(session, input);
        }

        log.warn("[Session-{}] Cannot send input - no Claude session ID for resume", sessionId);
        throw new IllegalStateException("Cannot resume session: Claude CLI session ID not found");
    }

    /**
     * Resume a stopped session with new input
     */
    private boolean resumeSession(Session session, String input) {
        Long sessionId = session.getId();
        Long agentId = session.getAgentId();

        Agent agent = agentRepository.findById(agentId)
                .orElseThrow(() -> new EntityNotFoundException("Agent", agentId));

        AgentAdapter adapter = adapterRegistry.getAgentAdapter(agent.getType());
        String claudeCliPath = getClaudeCliPath(adapter);

        log.info("[Session-{}] Resuming session | CLI: {} | WorkDir: {} | ClaudeSessionId: {}",
            sessionId, claudeCliPath, session.getWorktreePath(), session.getClaudeSessionId());

        String claudeSessionId = session.getClaudeSessionId();
        if (claudeSessionId == null || claudeSessionId.isEmpty()) {
            log.error("[Session-{}] No Claude session ID stored, cannot use --resume.", sessionId);
            throw new IllegalStateException(
                "Cannot resume session: Claude CLI session ID not found. Please start a new session instead.");
        }

        try {
            adapter.prepare(null, Paths.get(session.getWorktreePath()));

            // Note: User message is already added by sendInput() before calling resumeSession

            boolean started = processExecutor.start(
                sessionId,
                claudeCliPath,
                Paths.get(session.getWorktreePath()),
                input,
                claudeSessionId
            );

            if (!started) {
                throw new RuntimeException("Failed to resume Claude Code process");
            }

            session.setStatus(Session.SessionStatus.RUNNING);
            session.setLastHeartbeat(LocalDateTime.now());
            sessionRepository.save(session);

            log.info("[Session-{}] Session resumed successfully", sessionId);
            heartbeatMonitor.startMonitoring(sessionId);

            return true;

        } catch (Exception e) {
            log.error("[Session-{}] Failed to resume session: {}", sessionId, e.getMessage(), e);
            session.setStatus(Session.SessionStatus.ERROR);
            session.setStoppedAt(LocalDateTime.now());
            sessionRepository.save(session);
            return false;
        }
    }

    /**
     * Continue a stopped session with new input
     */
    public boolean continueSession(Long sessionId, String input) {
        Session session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new EntityNotFoundException("Session", sessionId));

        log.info("[Session-{}] Continue session requested | CurrentStatus: {}", sessionId, session.getStatus());

        if (session.getStatus() != Session.SessionStatus.STOPPED &&
            session.getStatus() != Session.SessionStatus.IDLE) {
            log.warn("[Session-{}] Cannot continue - session not stopped or idle: {}", sessionId, session.getStatus());
            throw new IllegalStateException("Session can only be continued when STOPPED or IDLE, current status: " + session.getStatus());
        }

        // Add user message before resuming
        addMessage(session, "user", input);
        // Reload session after addMessage
        session = sessionRepository.findById(sessionId).orElseThrow();

        return resumeSession(session, input);
    }

    public Optional<Session> getSession(Long sessionId) {
        return sessionRepository.findById(sessionId);
    }

    public Optional<Session> getSessionBySessionId(String wsSessionId) {
        return sessionRepository.findBySessionId(wsSessionId);
    }

    public Optional<Session> getActiveSessionByTaskId(Long taskId) {
        return sessionRepository.findActiveByTaskId(taskId);
    }

    public List<Session> getSessionsByTaskId(Long taskId) {
        return sessionRepository.findByTaskId(taskId);
    }

    public List<Session> getSessionsWithOutputByTaskId(Long taskId) {
        return sessionRepository.findByTaskId(taskId).stream()
                .sorted((a, b) -> {
                    // Sort by startedAt descending (most recent first)
                    if (a.getStartedAt() == null && b.getStartedAt() == null) return 0;
                    if (a.getStartedAt() == null) return 1;
                    if (b.getStartedAt() == null) return -1;
                    return b.getStartedAt().compareTo(a.getStartedAt());
                })
                .collect(Collectors.toList());
    }

    public String getSessionOutput(Long sessionId) {
        String output = processExecutor.getOutput(sessionId);
        if (output != null && !output.isEmpty()) {
            return output;
        }
        return sessionRepository.findById(sessionId)
                .map(session -> session.getOutput() != null ? session.getOutput() : "")
                .orElse("");
    }

    public void deleteSession(Long sessionId) {
        Session session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new EntityNotFoundException("Session", sessionId));

        log.info("[Session-{}] Deleting session | Status: {} | TaskId: {} | Worktree: {}",
            sessionId, session.getStatus(), session.getTaskId(), session.getWorktreePath());

        if (session.getStatus() == Session.SessionStatus.RUNNING ||
            session.getStatus() == Session.SessionStatus.IDLE) {
            log.debug("[Session-{}] Stopping running process before deletion", sessionId);
            processExecutor.stop(sessionId);
            heartbeatMonitor.stopMonitoring(sessionId);
        }

        // Note: Worktree is now owned by the task, not the session.
        // We do NOT remove the worktree when session is deleted.
        // The worktree will be reused when a new session is created for the same task.
        log.debug("[Session-{}] Keeping worktree for task reuse | Worktree: {}",
            sessionId, session.getWorktreePath());

        processExecutor.cleanup(sessionId);
        sessionRepository.delete(sessionId);
        log.info("[Session-{}] Session deleted successfully", sessionId);
    }

    public void updateSessionStatus(Long sessionId, Session.SessionStatus status) {
        sessionRepository.findById(sessionId).ifPresent(session -> {
            session.setStatus(status);
            session.setLastHeartbeat(LocalDateTime.now());
            sessionRepository.save(session);
        });
    }

    /**
     * Convert Session entity to DTO with optional output inclusion.
     * Falls back to process executor output if entity output is empty.
     *
     * @param session the session entity
     * @param includeOutput whether to include output
     * @return the SessionDTO
     */
    public com.devops.kanban.dto.SessionDTO toDTO(Session session, boolean includeOutput) {
        com.devops.kanban.dto.SessionDTO dto = converter.toDTO(session, includeOutput);
        if (includeOutput && (dto.getOutput() == null || dto.getOutput().isEmpty())) {
            // Fall back to process manager output
            String output = getSessionOutput(session.getId());
            dto.setOutput(output);
        }
        return dto;
    }

    /**
     * Convert Session entity to DTO with output.
     *
     * @param session the session entity
     * @return the SessionDTO
     */
    public com.devops.kanban.dto.SessionDTO toDTO(Session session) {
        return toDTO(session, true);
    }
}