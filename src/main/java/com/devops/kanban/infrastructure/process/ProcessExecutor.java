package com.devops.kanban.infrastructure.process;

import java.nio.file.Path;

/**
 * Interface for process execution in isolated environments.
 * Provides abstraction over different process execution strategies.
 */
public interface ProcessExecutor {

    /**
     * Start a new process for a session.
     *
     * @param sessionId the session ID
     * @param commandPath path to the executable
     * @param workDir working directory for the process
     * @param initialPrompt initial input to send to the process
     * @param resumeSessionId session ID for resume (null for fresh start)
     * @return true if process started successfully
     */
    boolean start(Long sessionId, String commandPath, Path workDir, String initialPrompt, String resumeSessionId);

    /**
     * Send input to a running process.
     *
     * @param sessionId the session ID
     * @param input the input string
     * @return true if input was sent successfully
     */
    boolean sendInput(Long sessionId, String input);

    /**
     * Stop a running process.
     *
     * @param sessionId the session ID
     */
    void stop(Long sessionId);

    /**
     * Check if a process is running.
     *
     * @param sessionId the session ID
     * @return true if the process is alive
     */
    boolean isRunning(Long sessionId);

    /**
     * Check if a process is alive (alias for isRunning).
     *
     * @param sessionId the session ID
     * @return true if the process is alive
     * @deprecated Use {@link #isRunning(Long)} instead
     */
    default boolean isAlive(Long sessionId) {
        return isRunning(sessionId);
    }

    /**
     * Get the output from a process.
     *
     * @param sessionId the session ID
     * @return the accumulated output
     */
    String getOutput(Long sessionId);

    /**
     * Get the exit code of a completed process.
     *
     * @param sessionId the session ID
     * @return exit code, or -1 if still running
     */
    int getExitCode(Long sessionId);

    /**
     * Cleanup resources for a session.
     *
     * @param sessionId the session ID
     */
    void cleanup(Long sessionId);

    /**
     * Persist the current output for a session.
     * Saves the accumulated output to the database.
     *
     * @param sessionId the session ID
     */
    void persistOutput(Long sessionId);

    /**
     * Wait for a process to complete.
     *
     * @param sessionId the session ID
     * @param timeoutSeconds maximum time to wait in seconds
     * @return true if process completed within timeout, false if still running or timed out
     */
    boolean waitForCompletion(Long sessionId, int timeoutSeconds);
}
