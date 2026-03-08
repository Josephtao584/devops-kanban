package com.devops.kanban.infrastructure.process;

import com.devops.kanban.dto.ChatMessageDTO;
import com.devops.kanban.entity.Session;
import com.devops.kanban.infrastructure.util.PlatformUtils;
import com.devops.kanban.infrastructure.websocket.SessionBroadcaster;
import com.devops.kanban.repository.SessionRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pty4j.PtyProcess;
import com.pty4j.PtyProcessBuilder;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/**
 * Executes Claude Code CLI using PTY.
 * Uses interactive mode with --dangerously-skip-permissions for non-interactive execution.
 */
@Component
@Slf4j
public class ClaudeCodeProcessExecutor implements ProcessExecutor {

    private static final int BUFFER_SIZE = 4096;
    private static final ObjectMapper objectMapper = new ObjectMapper();

    private final SimpMessagingTemplate messagingTemplate;
    private final SessionRepository sessionRepository;
    private final SessionBroadcaster sessionBroadcaster;
    private final ExecutorService executor = Executors.newCachedThreadPool();

    private final ConcurrentHashMap<Long, PtyProcess> activeProcesses = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<Long, StringBuilder> sessionOutputs = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<Long, StringBuilder> sessionRawJson = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<Long, OutputStream> sessionStdins = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<Long, Long> sessionStartTimes = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<Long, Boolean> sessionIdExtracted = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<Long, Long> lastPersistTime = new ConcurrentHashMap<>();

    // Stream-JSON fragment buffers for line-by-line JSON parsing
    private final ConcurrentHashMap<Long, StringBuilder> jsonFragmentBuffers = new ConcurrentHashMap<>();
    // Track current content block index for streaming
    private final ConcurrentHashMap<Long, Integer> currentBlockIndex = new ConcurrentHashMap<>();
    // Track accumulated content per block
    private final ConcurrentHashMap<Long, ConcurrentHashMap<Integer, StringBuilder>> blockContentBuffers = new ConcurrentHashMap<>();

    private static final long PERSIST_INTERVAL_MS = 5000;

    public ClaudeCodeProcessExecutor(SimpMessagingTemplate messagingTemplate,
                                     SessionRepository sessionRepository,
                                     SessionBroadcaster sessionBroadcaster) {
        this.messagingTemplate = messagingTemplate;
        this.sessionRepository = sessionRepository;
        this.sessionBroadcaster = sessionBroadcaster;
        log.info("[ClaudeCodeProcessExecutor] Initialized with PTY support");
    }

    @Override
    public boolean start(Long sessionId, String claudeCliPath, Path worktreePath, String initialPrompt, String claudeSessionId) {
        boolean isResume = claudeSessionId != null && !claudeSessionId.isEmpty();
        log.info("[Session-{}] Starting Claude Code (print mode) | CLI: {} | WorkDir: {} | isResume: {}",
            sessionId, claudeCliPath, worktreePath, isResume);

        try {
            // 1. Build command - ConPTY provides native UTF-8 support on Windows
            List<String> command = new ArrayList<>();

            if (claudeCliPath.endsWith(".js")) {
                command.add("node");
                command.add(claudeCliPath);
            } else {
                command.add(claudeCliPath);
            }

            // Use print mode (-p) with stream-json for real-time output
            command.add("-p");
            command.add("--dangerously-skip-permissions");
            command.add("--verbose");
            command.add("--output-format");
            command.add("stream-json");

            // Add --resume with session ID if this is a continuation
            if (claudeSessionId != null && !claudeSessionId.isEmpty()) {
                command.add("--resume");
                command.add(claudeSessionId);
                log.info("[Session-{}] Using --resume with Claude session ID: {}", sessionId, claudeSessionId);
            }

            // Pass initial prompt as command argument
            if (initialPrompt != null && !initialPrompt.isEmpty()) {
                command.add(initialPrompt);
                log.info("[Session-{}] Passing initial prompt as command argument ({} chars)", sessionId, initialPrompt.length());
                log.debug("[Session-{}] Full prompt content: {}", sessionId, initialPrompt);
            }

            // 2. Build environment
            Map<String, String> env = new HashMap<>();
            env.put("PATH", System.getenv("PATH"));

            // Platform-specific home and user variables
            if (PlatformUtils.isWindows()) {
                putIfNotNull(env, "SYSTEMROOT", System.getenv("SYSTEMROOT"));
                putIfNotNull(env, "COMSPEC", System.getenv("COMSPEC"));
                putIfNotNull(env, "WINDIR", System.getenv("WINDIR"));
                putIfNotNull(env, "TEMP", System.getenv("TEMP"));
                putIfNotNull(env, "TMP", System.getenv("TMP"));
                putIfNotNull(env, "USERPROFILE", System.getenv("USERPROFILE"));
                putIfNotNull(env, "USERNAME", System.getenv("USERNAME"));
                putIfNotNull(env, "APPDATA", System.getenv("APPDATA"));
                putIfNotNull(env, "LOCALAPPDATA", System.getenv("LOCALAPPDATA"));
                putIfNotNull(env, "ProgramFiles", System.getenv("ProgramFiles"));
                putIfNotNull(env, "ProgramFiles(x86)", System.getenv("ProgramFiles(x86)"));
                String userProfile = System.getenv("USERPROFILE");
                if (userProfile != null) {
                    env.put("HOME", userProfile);
                }
            } else {
                putIfNotNull(env, "HOME", System.getenv("HOME"));
                putIfNotNull(env, "USER", System.getenv("USER"));
                putIfNotNull(env, "TMPDIR", System.getenv("TMPDIR"));
            }

            // Force UTF-8 encoding
            env.put("LANG", "en_US.UTF-8");
            env.put("LC_ALL", "en_US.UTF-8");
            if (PlatformUtils.isWindows()) {
                env.put("PYTHONUTF8", "1");
                env.put("PYTHONIOENCODING", "utf-8");
                env.put("NODE_OPTIONS", "--no-warnings");
            }
            env.put("TERM", "xterm-256color");

            // Add ANTHROPIC_API_KEY if available
            String apiKey = System.getenv("ANTHROPIC_API_KEY");
            if (apiKey != null && !apiKey.isEmpty()) {
                env.put("ANTHROPIC_API_KEY", apiKey);
            }

            log.info("[Session-{}] Using print mode with permission bypass", sessionId);

            // 3. Start PTY process with ConPTY for proper UTF-8 support on Windows
            PtyProcessBuilder builder = new PtyProcessBuilder()
                    .setCommand(command.toArray(new String[0]))
                    .setDirectory(worktreePath.toString())
                    .setEnvironment(env);

            if (PlatformUtils.isWindows()) {
                builder.setUseWinConPty(true);
                // Set a very large terminal width to prevent line wrapping
                // which would corrupt JSON output
                builder.setInitialColumns(10000);
                builder.setInitialRows(100);
                log.info("[Session-{}] Using ConPTY for UTF-8 support (cols=10000)", sessionId);
            }

            PtyProcess process = builder.start();

            activeProcesses.put(sessionId, process);
            sessionStartTimes.put(sessionId, System.currentTimeMillis());

            // Preserve existing output when resuming session
            StringBuilder outputBuilder = sessionOutputs.get(sessionId);
            if (outputBuilder == null) {
                outputBuilder = new StringBuilder();
                final StringBuilder finalBuilder = outputBuilder;
                sessionRepository.findById(sessionId).ifPresent(session -> {
                    String existingOutput = session.getOutput();
                    if (existingOutput != null && !existingOutput.isEmpty()) {
                        finalBuilder.append(existingOutput);
                        log.info("[Session-{}] Loaded existing output from database ({} chars)",
                            sessionId, existingOutput.length());
                    }
                });
            }
            sessionOutputs.put(sessionId, outputBuilder);
            sessionRawJson.put(sessionId, new StringBuilder());

            OutputStream stdin = process.getOutputStream();
            sessionStdins.put(sessionId, stdin);

            // 4. Start output readers
            executor.submit(() -> {
                Thread.currentThread().setName("session-" + sessionId + "-stdout");
                readOutputStream(sessionId, process.getInputStream());
            });

            // 5. Wait for process exit
            executor.submit(() -> {
                Thread.currentThread().setName("session-" + sessionId + "-waiter");
                try {
                    long deadline = System.currentTimeMillis() + TimeUnit.HOURS.toMillis(2);
                    while (process.isAlive() && System.currentTimeMillis() < deadline) {
                        Thread.sleep(1000);
                    }
                    if (process.isAlive()) {
                        log.warn("[Session-{}] Process timeout after 2 hours", sessionId);
                    }
                    int exitCode = process.exitValue();
                    handleProcessExit(sessionId, exitCode);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    log.warn("[Session-{}] Process wait interrupted", sessionId);
                }
            });

            // 6. Broadcast running status
            broadcastStatus(sessionId, "RUNNING");

            log.info("[Session-{}] Claude Code started successfully in print mode", sessionId);
            return true;

        } catch (IOException e) {
            log.error("[Session-{}] Failed to start Claude Code: {}", sessionId, e.getMessage(), e);
            return false;
        }
    }

    /**
     * @deprecated Use {@link #start(Long, String, Path, String, String)} instead.
     */
    @Deprecated
    public boolean spawn(Long sessionId, String claudeCliPath, Path worktreePath, String initialPrompt, String claudeSessionId) {
        return start(sessionId, claudeCliPath, worktreePath, initialPrompt, claudeSessionId);
    }

    private void readOutputStream(Long sessionId, InputStream inputStream) {
        log.info("[Session-{}] Output reader thread started", sessionId);
        byte[] buffer = new byte[BUFFER_SIZE];
        int bytesRead;
        long totalBytes = 0;
        boolean processExited = false;

        try {
            // Initialize fragment buffer for stream-json parsing
            StringBuilder fragmentBuffer = jsonFragmentBuffers.computeIfAbsent(sessionId, k -> new StringBuilder());
            currentBlockIndex.put(sessionId, 0);
            blockContentBuffers.put(sessionId, new ConcurrentHashMap<>());

            PtyProcess process = activeProcesses.get(sessionId);

            while (!processExited) {
                int available = inputStream.available();

                if (available > 0) {
                    bytesRead = inputStream.read(buffer, 0, Math.min(available, buffer.length));
                    if (bytesRead == -1) {
                        log.info("[Session-{}] Stream returned -1 (EOF)", sessionId);
                        break;
                    }
                } else {
                    if (process != null && !process.isAlive()) {
                        bytesRead = inputStream.read(buffer);
                        if (bytesRead == -1) {
                            log.info("[Session-{}] Process exited, stream ended", sessionId);
                            break;
                        }
                        processExited = true;
                    } else {
                        try {
                            Thread.sleep(50);
                        } catch (InterruptedException ie) {
                            Thread.currentThread().interrupt();
                            log.debug("[Session-{}] Read interrupted", sessionId);
                            break;
                        }
                        continue;
                    }
                }

                String chunk = new String(buffer, 0, bytesRead, StandardCharsets.UTF_8);
                totalBytes += bytesRead;

                if (chunk.contains("\uFFFD")) {
                    log.warn("[Session-{}] Encoding issue detected: replacement character (U+FFFD) found in output.",
                        sessionId);
                }

                // Process chunk line by line for stream-json
                processStreamChunk(sessionId, chunk, fragmentBuffer);
            }

            log.info("[Session-{}] Output stream ended | Total bytes read: {}", sessionId, totalBytes);

            // Try to drain any remaining data from the stream
            // The process might have written more data after we detected it exited
            int remainingBytes;
            while (inputStream.available() > 0 && (remainingBytes = inputStream.read(buffer)) != -1) {
                String remainingChunk = new String(buffer, 0, remainingBytes, StandardCharsets.UTF_8);
                totalBytes += remainingBytes;
                log.info("[Session-{}] Drained additional {} bytes after stream end", sessionId, remainingBytes);
                processStreamChunk(sessionId, remainingChunk, fragmentBuffer);
            }
            log.info("[Session-{}] Final total bytes read: {}", sessionId, totalBytes);

            // Process any remaining fragment
            String remaining = fragmentBuffer.toString().trim();
            if (!remaining.isEmpty()) {
                log.info("[Session-{}] Processing remaining fragment ({} chars): {}", sessionId,
                    remaining.length(), remaining.substring(0, Math.min(200, remaining.length())));
                // Try to parse as JSON even if incomplete (might be useful for debugging)
                try {
                    String fixedJson = tryFixJson(remaining);
                    JsonNode node = objectMapper.readTree(fixedJson);
                    handleStreamJsonNode(sessionId, node);
                } catch (Exception e) {
                    log.info("[Session-{}] Remaining fragment is not valid JSON: {}", sessionId, e.getMessage());
                }
            }

        } catch (IOException e) {
            log.debug("[Session-{}] Output read error: {}", sessionId, e.getMessage());
        } finally {
            PtyProcess process = activeProcesses.get(sessionId);
            if (process != null && !process.isAlive()) {
                handleProcessExit(sessionId, process.exitValue());
            }
        }
    }

    /**
     * Process a chunk of stream-json output, extracting complete JSON objects.
     * Note: We cannot simply split by newlines because JSON content may contain
     * newlines inside string values (e.g., glm-5 model output).
     */
    private void processStreamChunk(Long sessionId, String chunk, StringBuilder fragmentBuffer) {
        // Debug: log raw chunk received (at debug level to reduce noise)
        log.debug("[Session-{}] Raw chunk received ({} bytes): {}", sessionId, chunk.length(),
            chunk.substring(0, Math.min(200, chunk.length())).replace("\n", "\\n").replace("\r", "\\r"));

        String combined = fragmentBuffer.toString() + chunk;
        fragmentBuffer.setLength(0);

        // Strip ANSI escape sequences from the combined string
        String cleaned = stripAnsiCodes(combined);

        // Extract complete JSON objects by finding matching braces
        int start = 0;
        int braceDepth = 0;
        boolean inString = false;
        boolean escape = false;
        int jsonCount = 0;

        for (int i = 0; i < cleaned.length(); i++) {
            char c = cleaned.charAt(i);

            if (escape) {
                escape = false;
                continue;
            }

            if (c == '\\' && inString) {
                escape = true;
                continue;
            }

            if (c == '"') {
                inString = !inString;
                continue;
            }

            if (!inString) {
                if (c == '{') {
                    if (braceDepth == 0) {
                        start = i;
                    }
                    braceDepth++;
                } else if (c == '}') {
                    braceDepth--;
                    if (braceDepth == 0) {
                        // Found a complete JSON object
                        jsonCount++;
                        String jsonStr = cleaned.substring(start, i + 1);
                        log.info("[Session-{}] Extracted JSON #{} ({} chars)", sessionId, jsonCount, jsonStr.length());
                        processStreamLine(sessionId, jsonStr);
                        start = i + 1;
                    }
                }
            }
        }

        log.info("[Session-{}] Chunk summary: {} total chars, {} JSON objects extracted, braceDepth={}",
            sessionId, cleaned.length(), jsonCount, braceDepth);

        // Buffer any remaining incomplete JSON
        if (start < cleaned.length()) {
            String remaining = cleaned.substring(start);
            if (!remaining.trim().isEmpty()) {
                fragmentBuffer.append(remaining);
                log.info("[Session-{}] Buffered {} chars of incomplete JSON (starts with: {})",
                    sessionId, remaining.length(),
                    remaining.substring(0, Math.min(100, remaining.length())));
            }
        }
    }

    /**
     * Process a single line of stream-json output.
     */
    private void processStreamLine(Long sessionId, String line) {
        if (line == null || line.isEmpty()) {
            return;
        }

        // Strip ANSI codes first
        String cleanLine = stripAnsiCodes(line);

        // Skip non-JSON lines
        if (!cleanLine.startsWith("{")) {
            log.info("[Session-{}] Skipping non-JSON line (first 100 chars): {}", sessionId,
                cleanLine.substring(0, Math.min(100, cleanLine.length())));
            return;
        }

        try {
            // Try to fix common JSON issues
            String fixedJson = tryFixJson(cleanLine);
            JsonNode node = objectMapper.readTree(fixedJson);
            handleStreamJsonNode(sessionId, node);
        } catch (Exception e) {
            log.info("[Session-{}] Failed to parse JSON line: {} | Line: {}",
                sessionId, e.getMessage(),
                cleanLine.substring(0, Math.min(200, cleanLine.length())));
        }
    }

    /**
     * Handle a parsed stream-json node.
     */
    private void handleStreamJsonNode(Long sessionId, JsonNode node) {
        if (node == null) {
            return;
        }

        String type = node.has("type") ? node.get("type").asText() : "";
        // Log all received types at INFO level for debugging
        log.info("[Session-{}] Received JSON type: {}", sessionId, type);

        // Handle session_id
        if (node.has("session_id")) {
            String claudeSessionId = node.get("session_id").asText();
            if (claudeSessionId != null && !claudeSessionId.isEmpty()) {
                log.info("[Session-{}] Extracted Claude session ID: {}", sessionId, claudeSessionId);
                sessionIdExtracted.put(sessionId, true);
                sessionRepository.findById(sessionId).ifPresent(session -> {
                    session.setClaudeSessionId(claudeSessionId);
                    sessionRepository.save(session);
                    sessionBroadcaster.broadcastClaudeSessionId(sessionId, claudeSessionId);
                });
            }
        }

        // Handle content_block_delta for streaming thinking/text
        if ("content_block_delta".equals(type)) {
            handleContentBlockDelta(sessionId, node);
            return;
        }

        // Handle assistant message (non-streaming mode with full message content)
        if ("assistant".equals(type)) {
            handleAssistantMessage(sessionId, node);
            return;
        }

        // Handle user message (contains tool_result content blocks)
        if ("user".equals(type)) {
            handleUserMessage(sessionId, node);
            return;
        }

        // Handle message_start
        if ("message_start".equals(type)) {
            log.debug("[Session-{}] Message started", sessionId);
            currentBlockIndex.put(sessionId, 0);
            sessionBroadcaster.broadcastMessageStart(sessionId);
            return;
        }

        // Handle content_block_start
        if ("content_block_start".equals(type)) {
            if (node.has("index")) {
                int index = node.get("index").asInt();
                currentBlockIndex.put(sessionId, index);
                log.debug("[Session-{}] Content block {} started", sessionId, index);
            }
            return;
        }

        // Handle content_block_stop
        if ("content_block_stop".equals(type)) {
            log.debug("[Session-{}] Content block stopped", sessionId);
            return;
        }

        // Handle message_stop
        if ("message_stop".equals(type)) {
            log.info("[Session-{}] Message completed", sessionId);
            persistOutputDebounced(sessionId);
            return;
        }

        // Handle result (final response in non-streaming or mixed mode)
        if (node.has("result")) {
            String result = node.get("result").asText();
            log.info("[Session-{}] Extracted result from JSON ({} chars)", sessionId, result.length());

            Session sessionOpt = sessionRepository.findById(sessionId).orElse(null);
            if (sessionOpt != null) {
                String prompt = sessionOpt.getInitialPrompt();
                if (prompt != null && !prompt.isEmpty()) {
                    result = removePromptEcho(sessionId, result, prompt);
                }
            }

            StringBuilder output = sessionOutputs.get(sessionId);
            if (output != null && !result.isEmpty()) {
                output.append(result);
            }
            if (!result.isEmpty()) {
                sessionBroadcaster.broadcastStreamingChunk(sessionId, "text", result, 0);
                log.info("[Session-{}] Broadcast result ({} chars)", sessionId, result.length());
            }
            persistOutputDebounced(sessionId);
        }

        // Handle permission_denials array
        if (node.has("permission_denials") && node.get("permission_denials").isArray()) {
            handlePermissionDenials(sessionId, node.get("permission_denials"));
        }
    }

    /**
     * Handle content_block_delta events for real-time streaming.
     */
    private void handleContentBlockDelta(Long sessionId, JsonNode node) {
        if (!node.has("delta")) {
            return;
        }

        JsonNode delta = node.get("delta");
        int blockIndex = node.has("index") ? node.get("index").asInt() : currentBlockIndex.getOrDefault(sessionId, 0);

        String contentType = null;
        String content = null;

        // Check for thinking content
        if (delta.has("thinking")) {
            contentType = "thinking";
            content = delta.get("thinking").asText();
        }
        // Check for text content
        else if (delta.has("text")) {
            contentType = "text";
            content = delta.get("text").asText();
        }

        if (content != null && !content.isEmpty()) {
            // Accumulate content to session output
            StringBuilder output = sessionOutputs.get(sessionId);
            if (output != null) {
                output.append(content);
            }

            // Broadcast streaming chunk with content type
            sessionBroadcaster.broadcastStreamingChunk(sessionId, contentType, content, blockIndex);
            log.debug("[Session-{}] Streamed {} chars (type={}, block={})",
                sessionId, content.length(), contentType, blockIndex);
        }
    }

    /**
     * Handle assistant message (non-streaming/batch mode with full message content).
     * Format: {"type":"assistant","message":{"content":[{"type":"thinking","thinking":"..."},{"type":"text","text":"..."},{"type":"tool_use","id":"...","name":"Bash","input":{...}}]}}
     */
    private void handleAssistantMessage(Long sessionId, JsonNode node) {
        log.info("[Session-{}] Handling assistant message", sessionId);

        // Extract uuid and parentUuid from top-level node
        String uuid = node.has("uuid") ? node.get("uuid").asText() : null;
        String parentUuid = node.has("parentUuid") ? node.get("parentUuid").asText() : null;
        log.debug("[Session-{}] Assistant message uuid={}, parentUuid={}", sessionId, uuid, parentUuid);

        if (!node.has("message")) {
            log.debug("[Session-{}] Assistant message has no 'message' field", sessionId);
            return;
        }

        JsonNode message = node.get("message");
        if (!message.has("content") || !message.get("content").isArray()) {
            log.debug("[Session-{}] Assistant message has no 'content' array", sessionId);
            return;
        }

        JsonNode contentArray = message.get("content");
        log.info("[Session-{}] Assistant message has {} content blocks", sessionId, contentArray.size());

        int blockIndex = 0;

        // Broadcast message_start to clear frontend state
        sessionBroadcaster.broadcastMessageStart(sessionId);

        // Collect text content for saving to database
        StringBuilder textContent = new StringBuilder();

        for (JsonNode contentBlock : contentArray) {
            String blockType = contentBlock.has("type") ? contentBlock.get("type").asText() : "";
            log.info("[Session-{}] Processing content block {}: type={}", sessionId, blockIndex, blockType);

            String content = null;
            String contentType = null;

            if ("thinking".equals(blockType) && contentBlock.has("thinking")) {
                content = contentBlock.get("thinking").asText();
                contentType = "thinking";
                // Save thinking message to database with uuid/parentUuid
                if (content != null && !content.isEmpty()) {
                    Map<String, Object> metadata = createUuidMetadata(uuid, parentUuid);
                    saveMessage(sessionId, "assistant", content, "thinking", metadata);
                }
                // Debug: log thinking content
                log.debug("[Session-{}] Claude THINKING content ({} chars): {}", sessionId,
                    content.length(), content.length() > 500 ? content.substring(0, 500) + "..." : content);
            } else if ("text".equals(blockType) && contentBlock.has("text")) {
                content = contentBlock.get("text").asText();
                contentType = "text";
                // Collect text content for database
                if (content != null && !content.isEmpty()) {
                    if (textContent.length() > 0) {
                        textContent.append("\n");
                    }
                    textContent.append(content);
                }
                // Debug: log text content
                log.debug("[Session-{}] Claude TEXT content ({} chars): {}", sessionId,
                    content.length(), content.length() > 500 ? content.substring(0, 500) + "..." : content);
            } else if ("tool_use".equals(blockType)) {
                // Handle tool_use content block with uuid/parentUuid
                handleToolUseBlock(sessionId, contentBlock, blockIndex, uuid, parentUuid);
            }

            log.info("[Session-{}] Content block {}: contentType={}, contentLength={}",
                sessionId, blockIndex, contentType, content != null ? content.length() : 0);

            if (content != null && !content.isEmpty()) {
                // Accumulate to session output
                StringBuilder output = sessionOutputs.get(sessionId);
                if (output != null) {
                    output.append(content);
                }

                // Broadcast to frontend
                sessionBroadcaster.broadcastStreamingChunk(sessionId, contentType, content, blockIndex);
                log.info("[Session-{}] Broadcast {} content ({} chars, block={})",
                    sessionId, contentType, content.length(), blockIndex);
            }
            blockIndex++;
        }

        // Save assistant text message to database with uuid/parentUuid
        if (textContent.length() > 0) {
            saveAssistantMessage(sessionId, textContent.toString(), uuid, parentUuid);
        }
    }

    /**
     * Handle a tool_use content block from an assistant message.
     * Format: {"type":"tool_use","id":"toolu_01...","name":"Bash","input":{...}}
     */
    private void handleToolUseBlock(Long sessionId, JsonNode contentBlock, int blockIndex, String uuid, String parentUuid) {
        String toolCallId = contentBlock.has("id") ? contentBlock.get("id").asText() : "unknown";
        String toolName = contentBlock.has("name") ? contentBlock.get("name").asText() : "unknown";

        Map<String, Object> toolInput = null;
        if (contentBlock.has("input")) {
            try {
                toolInput = objectMapper.convertValue(contentBlock.get("input"),
                    new TypeReference<Map<String, Object>>() {});
            } catch (Exception e) {
                log.warn("[Session-{}] Failed to parse tool input: {}", sessionId, e.getMessage());
                toolInput = new HashMap<>();
            }
        } else {
            toolInput = new HashMap<>();
        }

        log.info("[Session-{}] Tool use: {} (id={})", sessionId, toolName, toolCallId);
        log.debug("[Session-{}] Tool use input: {}", sessionId, toolInput);
        sessionBroadcaster.broadcastToolUse(sessionId, toolCallId, toolName, toolInput, blockIndex);

        // Save tool_use message to database with uuid/parentUuid
        Map<String, Object> metadata = createUuidMetadata(uuid, parentUuid);
        metadata.put("toolCallId", toolCallId);
        metadata.put("toolName", toolName);
        metadata.put("toolInput", toolInput);
        saveMessage(sessionId, "assistant", "", "tool_use", metadata);
    }

    /**
     * Handle user message (contains tool_result content blocks).
     * Format: {"type":"user","uuid":"...","parentUuid":"...","message":{"content":[{"type":"tool_result","tool_use_id":"...","content":"...","is_error":false}]}}
     */
    private void handleUserMessage(Long sessionId, JsonNode node) {
        log.info("[Session-{}] Handling user message", sessionId);

        // Extract uuid and parentUuid from top-level node
        String uuid = node.has("uuid") ? node.get("uuid").asText() : null;
        String parentUuid = node.has("parentUuid") ? node.get("parentUuid").asText() : null;
        log.debug("[Session-{}] User message uuid={}, parentUuid={}", sessionId, uuid, parentUuid);

        if (!node.has("message")) {
            log.debug("[Session-{}] User message has no 'message' field", sessionId);
            return;
        }

        JsonNode message = node.get("message");
        if (!message.has("content") || !message.get("content").isArray()) {
            log.debug("[Session-{}] User message has no 'content' array", sessionId);
            return;
        }

        JsonNode contentArray = message.get("content");
        log.info("[Session-{}] User message has {} content blocks", sessionId, contentArray.size());

        for (JsonNode contentBlock : contentArray) {
            String blockType = contentBlock.has("type") ? contentBlock.get("type").asText() : "";

            if ("tool_result".equals(blockType)) {
                String toolUseId = contentBlock.has("tool_use_id") ? contentBlock.get("tool_use_id").asText() : "unknown";
                String content = contentBlock.has("content") ? contentBlock.get("content").asText() : "";
                boolean isError = contentBlock.has("is_error") && contentBlock.get("is_error").asBoolean();

                log.info("[Session-{}] Tool result: {} (error={})", sessionId, toolUseId, isError);
                log.debug("[Session-{}] Tool result content ({} chars): {}", sessionId,
                    content.length(), content.length() > 500 ? content.substring(0, 500) + "..." : content);
                sessionBroadcaster.broadcastToolResult(sessionId, toolUseId, content, isError);

                // Save tool_result message to database with uuid/parentUuid
                Map<String, Object> metadata = createUuidMetadata(uuid, parentUuid);
                metadata.put("toolUseId", toolUseId);
                metadata.put("toolIsError", isError);
                saveMessage(sessionId, "user", content, "tool_result", metadata);
            }
        }
    }

    /**
     * Handle permission_denials array from a result message.
     * Format: {"permission_denials":[{"resource":"...","reason":"..."}]}
     */
    private void handlePermissionDenials(Long sessionId, JsonNode denialsArray) {
        if (denialsArray == null || !denialsArray.isArray()) {
            return;
        }

        for (JsonNode denial : denialsArray) {
            String resource = denial.has("resource") ? denial.get("resource").asText() : "unknown";
            String reason = denial.has("reason") ? denial.get("reason").asText() : "No reason provided";

            log.info("[Session-{}] Permission denied: {} - {}", sessionId, resource, reason);
            sessionBroadcaster.broadcastPermissionDenial(sessionId, resource, reason);

            // Save permission_denied message to database
            Map<String, Object> metadata = new HashMap<>();
            metadata.put("resource", resource);
            metadata.put("reason", reason);
            saveMessage(sessionId, "system", resource, "permission_denied", metadata);
        }
    }

    /**
     * Try to fix common JSON issues from Claude CLI output.
     */
    private String tryFixJson(String json) {
        if (json == null || json.isEmpty()) {
            return json;
        }

        // Fix common typos in Claude's JSON output
        String fixed = json;

        // Fix: duratiion -> duration
        fixed = fixed.replace("\"duratiion\":", "\"duration\":");
        fixed = fixed.replace("\"duraton\":", "\"duration\":");

        // Fix: contet -> content
        fixed = fixed.replace("\"contet\":", "\"content\":");

        // Fix: thunking -> thinking (rare typo)
        fixed = fixed.replace("\"thunking\":", "\"thinking\":");

        // Remove trailing commas before } or ]
        fixed = fixed.replaceAll(",\\s*}", "}");
        fixed = fixed.replaceAll(",\\s*]", "]");

        // Escape control characters inside JSON string values
        // This handles the case where glm-5 outputs actual newlines in string values
        fixed = escapeControlCharsInJsonStrings(fixed);

        return fixed;
    }

    /**
     * Escape control characters inside JSON string values.
     * This handles models like glm-5 that output actual newlines in string values
     * instead of escaped \n sequences.
     */
    private String escapeControlCharsInJsonStrings(String json) {
        if (json == null || json.isEmpty()) {
            return json;
        }

        StringBuilder result = new StringBuilder(json.length() * 2);
        boolean inString = false;
        boolean escape = false;

        for (int i = 0; i < json.length(); i++) {
            char c = json.charAt(i);

            if (escape) {
                // Previous char was backslash, this char is escaped
                result.append(c);
                escape = false;
                continue;
            }

            if (c == '\\' && inString) {
                result.append(c);
                escape = true;
                continue;
            }

            if (c == '"') {
                inString = !inString;
                result.append(c);
                continue;
            }

            if (inString) {
                // Inside a string value - escape control characters
                switch (c) {
                    case '\n':
                        result.append("\\n");
                        break;
                    case '\r':
                        result.append("\\r");
                        break;
                    case '\t':
                        result.append("\\t");
                        break;
                    case '\b':
                        result.append("\\b");
                        break;
                    case '\f':
                        result.append("\\f");
                        break;
                    default:
                        if (c < 0x20) {
                            // Other control characters - escape as backslash-u-XXXX
                            result.append(String.format("\\u%04x", (int) c));
                        } else {
                            result.append(c);
                        }
                }
            } else {
                // Outside string - remove control characters except whitespace
                if (c == '\n' || c == '\r' || c == '\t' || c >= 0x20) {
                    result.append(c);
                }
            }
        }

        return result.toString();
    }

    @Override
    public boolean sendInput(Long sessionId, String input) {
        PtyProcess process = activeProcesses.get(sessionId);
        OutputStream stdin = sessionStdins.get(sessionId);

        if (process == null || stdin == null) {
            log.warn("[Session-{}] No active process or stdin", sessionId);
            return false;
        }

        if (!process.isAlive()) {
            log.warn("[Session-{}] Process is not alive", sessionId);
            return false;
        }

        try {
            StringBuilder output = sessionOutputs.get(sessionId);
            if (output != null) {
                output.append("> ").append(input).append("\n");
            }

            stdin.write((input + "\n").getBytes(StandardCharsets.UTF_8));
            stdin.flush();
            log.info("[Session-{}] Sent input: {} chars", sessionId, input.length());
            return true;
        } catch (IOException e) {
            log.error("[Session-{}] Failed to send input: {}", sessionId, e.getMessage());
            return false;
        }
    }

    @Override
    public void stop(Long sessionId) {
        persistOutput(sessionId);

        PtyProcess process = activeProcesses.remove(sessionId);
        Long startTime = sessionStartTimes.remove(sessionId);
        long duration = startTime != null ? System.currentTimeMillis() - startTime : 0;

        if (process != null) {
            process.destroy();
            try {
                long deadline = System.currentTimeMillis() + 3000;
                while (process.isAlive() && System.currentTimeMillis() < deadline) {
                    Thread.sleep(100);
                }
                if (process.isAlive()) {
                    log.warn("[Session-{}] Force killing process", sessionId);
                    process.destroyForcibly();
                }
                log.info("[Session-{}] Process stopped | Duration: {}ms", sessionId, duration);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }

        sessionStdins.remove(sessionId);
        broadcastStatus(sessionId, "STOPPED");
    }

    @Override
    public boolean isRunning(Long sessionId) {
        PtyProcess process = activeProcesses.get(sessionId);
        return process != null && process.isAlive();
    }

    @Override
    public boolean waitForCompletion(Long sessionId, int timeoutSeconds) {
        PtyProcess process = activeProcesses.get(sessionId);
        if (process == null) {
            return true; // Already completed
        }
        try {
            log.info("[Session-{}] Waiting for process to complete (timeout: {}s)", sessionId, timeoutSeconds);
            boolean exited = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);
            if (exited) {
                log.info("[Session-{}] Process completed", sessionId);
            } else {
                log.warn("[Session-{}] Process did not complete within timeout", sessionId);
            }
            return exited;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("[Session-{}] Wait interrupted", sessionId);
            return false;
        }
    }

    /**
     * @deprecated Use {@link #isRunning(Long)} instead.
     */
    @Deprecated
    public boolean isAlive(Long sessionId) {
        return isRunning(sessionId);
    }

    @Override
    public int getExitCode(Long sessionId) {
        PtyProcess process = activeProcesses.get(sessionId);
        if (process != null && !process.isAlive()) {
            return process.exitValue();
        }
        return -1;
    }

    @Override
    public String getOutput(Long sessionId) {
        StringBuilder output = sessionOutputs.get(sessionId);
        return output != null ? output.toString() : "";
    }

    private void handleProcessExit(Long sessionId, int exitCode) {
        Long startTime = sessionStartTimes.get(sessionId);
        long duration = startTime != null ? System.currentTimeMillis() - startTime : 0;

        persistOutput(sessionId);

        log.info("[Session-{}] Process exited | Code: {} | Duration: {}ms",
            sessionId, exitCode, duration);

        String status = exitCode == 0 ? "STOPPED" : "ERROR";
        broadcastStatus(sessionId, status);

        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "exit");
        payload.put("exitCode", exitCode);
        payload.put("status", status);
        payload.put("durationMs", duration);
        payload.put("timestamp", System.currentTimeMillis());
        messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/status", payload);

        sessionStartTimes.remove(sessionId);
        sessionStdins.remove(sessionId);
    }

    private void broadcastChunk(Long sessionId, String stream, String content, boolean isComplete) {
        String role = "stdin".equals(stream) ? "user" : "assistant";

        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "chunk");
        payload.put("stream", stream);
        payload.put("role", role);
        payload.put("content", content);
        payload.put("isComplete", isComplete);
        payload.put("timestamp", System.currentTimeMillis());

        messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/output", payload);

        // Save assistant message to database (only for complete responses)
        if (isComplete && "assistant".equals(role) && content != null && !content.trim().isEmpty()) {
            saveAssistantMessage(sessionId, content, null, null);
        }

        log.debug("[Session-{}] Broadcast {} chars (stream={})", sessionId, content.length(), stream);
    }

    private void saveAssistantMessage(Long sessionId, String content, String uuid, String parentUuid) {
        // Save text message with contentType and uuid/parentUuid
        Map<String, Object> metadata = createUuidMetadata(uuid, parentUuid);
        saveMessage(sessionId, "assistant", content, "text", metadata);
    }

    /**
     * Create metadata map with uuid and parentUuid.
     */
    private Map<String, Object> createUuidMetadata(String uuid, String parentUuid) {
        Map<String, Object> metadata = new HashMap<>();
        if (uuid != null) {
            metadata.put("uuid", uuid);
        }
        if (parentUuid != null) {
            metadata.put("parentUuid", parentUuid);
        }
        return metadata;
    }

    /**
     * Save a message with full metadata support.
     */
    private void saveMessage(Long sessionId, String role, String content, String contentType,
                              java.util.Map<String, Object> metadata) {
        sessionRepository.findById(sessionId).ifPresent(session -> {
            try {
                List<ChatMessageDTO> messages;
                String existingMessages = session.getMessages();

                if (existingMessages == null || existingMessages.isEmpty()) {
                    messages = new ArrayList<>();
                } else {
                    messages = objectMapper.readValue(existingMessages, new TypeReference<List<ChatMessageDTO>>() {});
                }

                // Check for duplicates based on role, content, and contentType
                boolean exists = messages.stream()
                    .anyMatch(m -> role.equals(m.getRole())
                        && content.equals(m.getContent())
                        && (contentType == null ? m.getContentType() == null : contentType.equals(m.getContentType())));
                if (exists) {
                    log.debug("[Session-{}] Message already exists, skipping", sessionId);
                    return;
                }

                ChatMessageDTO.ChatMessageDTOBuilder builder = ChatMessageDTO.builder()
                    .id(String.valueOf(System.currentTimeMillis()))
                    .role(role)
                    .content(content)
                    .contentType(contentType)
                    .timestamp(java.time.LocalDateTime.now().format(java.time.format.DateTimeFormatter.ISO_LOCAL_DATE_TIME));

                // Add metadata if present
                if (metadata != null) {
                    if (metadata.get("uuid") != null) {
                        builder.uuid((String) metadata.get("uuid"));
                    }
                    if (metadata.get("parentUuid") != null) {
                        builder.parentUuid((String) metadata.get("parentUuid"));
                    }
                    if (metadata.get("toolCallId") != null) {
                        builder.toolCallId((String) metadata.get("toolCallId"));
                    }
                    if (metadata.get("toolName") != null) {
                        builder.toolName((String) metadata.get("toolName"));
                    }
                    if (metadata.get("toolInput") != null) {
                        @SuppressWarnings("unchecked")
                        java.util.Map<String, Object> toolInput = (java.util.Map<String, Object>) metadata.get("toolInput");
                        builder.toolInput(toolInput);
                    }
                    if (metadata.get("toolIsError") != null) {
                        builder.toolIsError((Boolean) metadata.get("toolIsError"));
                    }
                    if (metadata.get("resource") != null) {
                        builder.permissionResource((String) metadata.get("resource"));
                    }
                    if (metadata.get("reason") != null) {
                        builder.permissionReason((String) metadata.get("reason"));
                    }
                }

                messages.add(builder.build());

                session.setMessages(objectMapper.writeValueAsString(messages));
                sessionRepository.save(session);
                log.debug("[Session-{}] Saved {} message (contentType={}, {} chars)",
                    sessionId, role, contentType, content.length());
            } catch (Exception e) {
                log.warn("[Session-{}] Failed to save message: {}", sessionId, e.getMessage());
            }
        });
    }

    private void broadcastStatus(Long sessionId, String status) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "status");
        payload.put("status", status);
        payload.put("sessionId", sessionId);
        payload.put("timestamp", System.currentTimeMillis());

        messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/status", payload);

        log.info("[Session-{}] Status: {}", sessionId, status);
    }

    private void persistOutputDebounced(Long sessionId) {
        long now = System.currentTimeMillis();
        Long last = lastPersistTime.get(sessionId);
        if (last == null || (now - last) > PERSIST_INTERVAL_MS) {
            persistOutput(sessionId);
            lastPersistTime.put(sessionId, now);
        }
    }

    public void persistOutput(Long sessionId) {
        StringBuilder output = sessionOutputs.get(sessionId);
        if (output == null || output.length() == 0) {
            return;
        }

        sessionRepository.findById(sessionId).ifPresent(session -> {
            session.setOutput(output.toString());
            sessionRepository.save(session);
            log.debug("[Session-{}] Persisted output ({} chars)", sessionId, output.length());
        });
    }

    private String stripAnsiCodes(String input) {
        if (input == null) return "";
        return input
                // Standard CSI sequences: ESC [ ... final_byte
                .replaceAll("\\x1B\\[[0-?]*[ -/]*[@-~]", "")
                // OSC sequences: ESC ] ... BEL or ESC ] ... ST
                .replaceAll("\\x1B\\][^\\x07\\x1B]*(?:\\x07|\\x1B\\\\)", "")
                // Character set selection
                .replaceAll("\\x1B[()][AB012]", "")
                // Keypad modes
                .replaceAll("\\x1B[78]", "")
                // Other escape sequences
                .replaceAll("\\x1B[=>]", "")
                // Control characters except newline (keep \n for JSON strings)
                .replaceAll("[\\x00-\\x09\\x0B\\x0C\\x0E-\\x1F\\x7F]", "")
                // OSC sequence without ESC at start of line: ]0;title BEL
                .replaceAll("^\\][0-9;]*[^\\x07]*\\x07?", "")
                // Private mode sequences without ESC at start: [?9001h, [?25l, etc.
                .replaceAll("^\\[\\?[0-9;]*[hl]", "")
                // Replace \r\n with just \n (Windows line endings to Unix)
                .replaceAll("\\r\\n", "\n")
                // Replace standalone \r with nothing (stray carriage returns)
                .replaceAll("\\r", "");
    }

    private String removePromptEcho(Long sessionId, String result, String prompt) {
        if (result == null || result.isEmpty() || prompt == null || prompt.isEmpty()) {
            return result;
        }

        String trimmedResult = result.trim();
        String trimmedPrompt = prompt.trim();

        // Strategy 1: Exact match at start
        if (trimmedResult.startsWith(trimmedPrompt)) {
            int idx = result.indexOf(trimmedPrompt);
            if (idx >= 0) {
                String remaining = result.substring(idx + trimmedPrompt.length());
                remaining = remaining.replaceFirst("^[\\s\\n\\r]+", "");
                log.info("[Session-{}] Removed prompt echo (exact match, {} chars)", sessionId, trimmedPrompt.length());
                return remaining;
            }
        }

        // Strategy 2: Multi-line prompt - check if first few lines match
        String[] promptLines = trimmedPrompt.split("\\r?\\n", 2);
        String[] resultLines = trimmedResult.split("\\r?\\n", 2);
        if (promptLines.length > 0 && resultLines.length > 0) {
            String firstPromptLine = promptLines[0].trim();
            String firstResultLine = resultLines[0].trim();
            if (!firstPromptLine.isEmpty() && firstResultLine.equals(firstPromptLine)) {
                int firstLineIdx = result.indexOf(firstPromptLine);
                if (firstLineIdx >= 0) {
                    int promptEndIdx = firstLineIdx + firstPromptLine.length();
                    if (promptLines.length > 1 && resultLines.length > 1) {
                        String secondPromptLine = promptLines[1].trim();
                        if (!secondPromptLine.isEmpty()) {
                            int secondLineStart = result.indexOf(secondPromptLine, promptEndIdx);
                            if (secondLineStart >= 0 && secondLineStart < promptEndIdx + 100) {
                                promptEndIdx = secondLineStart + secondPromptLine.length();
                            }
                        }
                    }
                    String remaining = result.substring(promptEndIdx);
                    remaining = remaining.replaceFirst("^[\\s\\n\\r]+", "");
                    log.info("[Session-{}] Removed prompt echo (line-by-line match)", sessionId);
                    return remaining;
                }
            }
        }

        // Strategy 3: Fuzzy match
        String normalizedResult = trimmedResult.replaceAll("\\s+", " ");
        String normalizedPrompt = trimmedPrompt.replaceAll("\\s+", " ");
        if (normalizedResult.startsWith(normalizedPrompt)) {
            int endIdx = 0;
            int promptCharIdx = 0;
            for (int i = 0; i < result.length() && promptCharIdx < prompt.length(); i++) {
                char rc = result.charAt(i);
                char pc = prompt.charAt(promptCharIdx);
                if (rc == pc || (Character.isWhitespace(rc) && Character.isWhitespace(pc))) {
                    promptCharIdx++;
                }
                endIdx = i + 1;
            }
            if (promptCharIdx >= prompt.length() * 0.9) {
                String remaining = result.substring(endIdx);
                remaining = remaining.replaceFirst("^[\\s\\n\\r]+", "");
                log.info("[Session-{}] Removed prompt echo (fuzzy match)", sessionId);
                return remaining;
            }
        }

        log.debug("[Session-{}] No prompt echo detected in result", sessionId);
        return result;
    }

    @Override
    public void cleanup(Long sessionId) {
        stop(sessionId);
        sessionOutputs.remove(sessionId);
        sessionRawJson.remove(sessionId);
        lastPersistTime.remove(sessionId);
        sessionIdExtracted.remove(sessionId);
        // Clean up streaming buffers
        jsonFragmentBuffers.remove(sessionId);
        currentBlockIndex.remove(sessionId);
        blockContentBuffers.remove(sessionId);
        log.debug("[Session-{}] Resources cleaned up", sessionId);
    }

    private void putIfNotNull(Map<String, String> map, String key, String value) {
        if (value != null && !value.isEmpty()) {
            map.put(key, value);
        }
    }
}
