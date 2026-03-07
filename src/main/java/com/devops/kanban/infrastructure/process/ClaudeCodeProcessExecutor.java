package com.devops.kanban.infrastructure.process;

import com.devops.kanban.entity.Session;
import com.devops.kanban.infrastructure.util.PlatformUtils;
import com.devops.kanban.infrastructure.websocket.SessionBroadcaster;
import com.devops.kanban.repository.SessionRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pty4j.PtyProcess;
import com.pty4j.PtyProcessBuilder;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

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
@Service
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

            // Use print mode (-p) for clean output
            command.add("-p");
            command.add("--dangerously-skip-permissions");
            command.add("--output-format");
            command.add("json");

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
                log.info("[Session-{}] Using ConPTY for UTF-8 support", sessionId);
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
        byte[] buffer = new byte[BUFFER_SIZE];
        int bytesRead;
        long totalBytes = 0;
        boolean processExited = false;

        try {
            StringBuilder rawJsonBuilder = sessionRawJson.get(sessionId);
            if (rawJsonBuilder == null) {
                rawJsonBuilder = new StringBuilder();
                sessionRawJson.put(sessionId, rawJsonBuilder);
            }

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

                if (totalBytes <= 10240) {
                    log.info("[Session-{}] Raw chunk ({} bytes): {}", sessionId, bytesRead,
                        chunk.substring(0, Math.min(200, chunk.length())).replace("\n", "\\n").replace("\r", "\\r"));
                }

                rawJsonBuilder.append(chunk);
            }

            log.info("[Session-{}] Output stream ended | Total bytes read: {}", sessionId, totalBytes);

            String rawOutput = rawJsonBuilder.toString().trim();
            String cleanJson = stripAnsiCodes(rawOutput);
            log.debug("[Session-{}] Cleaned JSON (first 500 chars): {}", sessionId,
                cleanJson.substring(0, Math.min(500, cleanJson.length())));

            if (!cleanJson.isEmpty()) {
                try {
                    int jsonStart = cleanJson.indexOf('{');
                    int jsonEnd = cleanJson.lastIndexOf('}');
                    if (jsonStart >= 0 && jsonEnd > jsonStart) {
                        String jsonString = cleanJson.substring(jsonStart, jsonEnd + 1);
                        JsonNode jsonNode = objectMapper.readTree(jsonString);

                        if (jsonNode.has("session_id")) {
                            String claudeSessionId = jsonNode.get("session_id").asText();
                            log.info("[Session-{}] Extracted Claude session ID from JSON: {}", sessionId, claudeSessionId);
                            sessionIdExtracted.put(sessionId, true);
                            sessionRepository.findById(sessionId).ifPresent(session -> {
                                session.setClaudeSessionId(claudeSessionId);
                                sessionRepository.save(session);
                                log.info("[Session-{}] Saved Claude session ID to session entity", sessionId);
                                sessionBroadcaster.broadcastClaudeSessionId(sessionId, claudeSessionId);
                            });
                        }

                        if (jsonNode.has("result")) {
                            String result = jsonNode.get("result").asText();
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
                                broadcastChunk(sessionId, "stdout", result, true);
                                log.info("[Session-{}] Broadcast result ({} chars)", sessionId, result.length());
                            }
                        } else {
                            log.warn("[Session-{}] JSON output does not contain 'result' field", sessionId);
                            StringBuilder output = sessionOutputs.get(sessionId);
                            if (output != null) {
                                output.append(cleanJson);
                            }
                            broadcastChunk(sessionId, "stdout", cleanJson, true);
                        }

                        persistOutputDebounced(sessionId);
                    } else {
                        log.warn("[Session-{}] No valid JSON object found in output", sessionId);
                        StringBuilder output = sessionOutputs.get(sessionId);
                        if (output != null) {
                            output.append(cleanJson);
                        }
                        broadcastChunk(sessionId, "stdout", cleanJson, true);
                    }

                } catch (Exception e) {
                    log.warn("[Session-{}] Failed to parse JSON output: {} | Clean output: {}",
                        sessionId, e.getMessage(), cleanJson.substring(0, Math.min(500, cleanJson.length())));
                    StringBuilder output = sessionOutputs.get(sessionId);
                    if (output != null) {
                        output.append(cleanJson);
                    }
                    broadcastChunk(sessionId, "stdout", cleanJson, true);
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

        log.debug("[Session-{}] Broadcast {} chars (stream={})", sessionId, content.length(), stream);
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
                .replaceAll("\\x1B\\[[0-?]*[ -/]*[@-~]", "")
                .replaceAll("\\x1B\\][^\\x07\\x1B]*(?:\\x07|\\x1B\\\\)", "")
                .replaceAll("\\x1B[()][AB012]", "")
                .replaceAll("\\x1B[78]", "")
                .replaceAll("\\x1B[=>]", "")
                .replaceAll("[\\x00-\\x1F\\x7F]", "")
                .replaceAll("\\[[0-9;]*[A-Za-z]", "");
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
        log.debug("[Session-{}] Resources cleaned up", sessionId);
    }

    private void putIfNotNull(Map<String, String> map, String key, String value) {
        if (value != null && !value.isEmpty()) {
            map.put(key, value);
        }
    }
}
