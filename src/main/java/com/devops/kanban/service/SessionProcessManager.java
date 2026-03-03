package com.devops.kanban.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Manages AI agent processes for interactive sessions.
 * Handles process lifecycle, I/O streams, and real-time output broadcasting.
 */
@Service
@Slf4j
public class SessionProcessManager {

    private final SimpMessagingTemplate messagingTemplate;
    private final ExecutorService executor = Executors.newCachedThreadPool();

    // Active process management
    private final ConcurrentHashMap<Long, Process> activeProcesses = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<Long, BufferedWriter> processInputs = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<Long, StringBuilder> sessionOutputs = new ConcurrentHashMap<>();

    public SessionProcessManager(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Start a new process for a session
     *
     * @param sessionId  the session ID
     * @param command    the command array to execute
     * @param workingDir the working directory
     * @return the started process
     */
    public Process startProcess(Long sessionId, String[] command, Path workingDir) {
        try {
            ProcessBuilder pb = new ProcessBuilder(command);
            pb.directory(workingDir.toFile());
            pb.environment().putAll(System.getenv());

            // Don't merge stderr - we want to handle them separately
            Process process = pb.start();

            // Store process reference
            activeProcesses.put(sessionId, process);

            // Store output buffer for this session
            sessionOutputs.put(sessionId, new StringBuilder());

            // Setup stdin writer for interactive input
            BufferedWriter writer = new BufferedWriter(
                    new OutputStreamWriter(process.getOutputStream(), StandardCharsets.UTF_8));
            processInputs.put(sessionId, writer);

            // Start stdout reader thread
            executor.submit(() -> readStream(sessionId, process.getInputStream(), "stdout"));

            // Start stderr reader thread
            executor.submit(() -> readStream(sessionId, process.getErrorStream(), "stderr"));

            log.info("Started process for session {}: {}", sessionId, String.join(" ", command));
            return process;

        } catch (IOException e) {
            log.error("Failed to start process for session {}", sessionId, e);
            throw new RuntimeException("Failed to start process", e);
        }
    }

    /**
     * Stop a running process
     *
     * @param sessionId the session ID
     */
    public void stopProcess(Long sessionId) {
        Process process = activeProcesses.remove(sessionId);
        BufferedWriter writer = processInputs.remove(sessionId);

        if (process != null) {
            process.destroy();
            log.info("Stopped process for session {}", sessionId);
        }

        if (writer != null) {
            try {
                writer.close();
            } catch (IOException e) {
                log.warn("Failed to close process input for session {}", sessionId);
            }
        }

        // Broadcast stopped status
        broadcastStatus(sessionId, "STOPPED");
    }

    /**
     * Send input to a running process
     *
     * @param sessionId the session ID
     * @param input     the input to send
     * @return true if input was sent successfully
     */
    public boolean sendInput(Long sessionId, String input) {
        BufferedWriter writer = processInputs.get(sessionId);
        if (writer == null) {
            log.warn("No active input stream for session {}", sessionId);
            return false;
        }

        try {
            writer.write(input);
            writer.newLine();
            writer.flush();
            log.debug("Sent input to session {}: {}", sessionId, input);

            // Echo the input to output
            broadcastOutput(sessionId, "stdin", "> " + input);
            return true;

        } catch (IOException e) {
            log.error("Failed to send input to session {}", sessionId, e);
            return false;
        }
    }

    /**
     * Check if a process is alive
     *
     * @param sessionId the session ID
     * @return true if process is running
     */
    public boolean isProcessAlive(Long sessionId) {
        Process process = activeProcesses.get(sessionId);
        return process != null && process.isAlive();
    }

    /**
     * Get the exit code of a process
     *
     * @param sessionId the session ID
     * @return the exit code, or -1 if process is still running or not found
     */
    public int getExitCode(Long sessionId) {
        Process process = activeProcesses.get(sessionId);
        if (process != null && !process.isAlive()) {
            return process.exitValue();
        }
        return -1;
    }

    /**
     * Get the accumulated output for a session
     *
     * @param sessionId the session ID
     * @return the output string
     */
    public String getOutput(Long sessionId) {
        StringBuilder output = sessionOutputs.get(sessionId);
        return output != null ? output.toString() : "";
    }

    /**
     * Clear session resources
     *
     * @param sessionId the session ID
     */
    public void cleanup(Long sessionId) {
        stopProcess(sessionId);
        sessionOutputs.remove(sessionId);
    }

    /**
     * Read from an input stream and broadcast to WebSocket
     */
    private void readStream(Long sessionId, InputStream inputStream, String streamName) {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {

            String line;
            while ((line = reader.readLine()) != null) {
                // Store in buffer
                StringBuilder output = sessionOutputs.get(sessionId);
                if (output != null) {
                    output.append(line).append("\n");
                }

                // Broadcast to WebSocket
                broadcastOutput(sessionId, streamName, line);
            }

        } catch (IOException e) {
            if (!e.getMessage().contains("Stream closed")) {
                log.debug("Stream read error for session {}: {}", sessionId, e.getMessage());
            }
        } finally {
            // Check if process has ended
            Process process = activeProcesses.get(sessionId);
            if (process != null && !process.isAlive()) {
                handleProcessEnd(sessionId, process.exitValue());
            }
        }
    }

    /**
     * Handle process termination
     */
    private void handleProcessEnd(Long sessionId, int exitCode) {
        log.info("Process ended for session {} with exit code {}", sessionId, exitCode);

        // Broadcast final status
        String status = exitCode == 0 ? "COMPLETED" : "ERROR";
        broadcastStatus(sessionId, status);

        // Broadcast exit code
        Map<String, Object> payload = Map.of(
                "type", "exit",
                "exitCode", exitCode,
                "status", status
        );
        messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/status", payload);

        // Cleanup
        processInputs.remove(sessionId);
    }

    /**
     * Broadcast output to WebSocket subscribers
     */
    private void broadcastOutput(Long sessionId, String stream, String line) {
        Map<String, Object> payload = Map.of(
                "type", "output",
                "stream", stream,
                "data", line,
                "timestamp", System.currentTimeMillis()
        );
        messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/output", payload);
    }

    /**
     * Broadcast status update to WebSocket subscribers
     */
    private void broadcastStatus(Long sessionId, String status) {
        Map<String, Object> payload = Map.of(
                "type", "status",
                "status", status,
                "timestamp", System.currentTimeMillis()
        );
        messagingTemplate.convertAndSend("/topic/session/" + sessionId + "/status", payload);
    }
}
