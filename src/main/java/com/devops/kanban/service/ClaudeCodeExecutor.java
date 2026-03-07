package com.devops.kanban.service;

import com.devops.kanban.infrastructure.process.ProcessExecutor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.nio.file.Path;

/**
 * Backward-compatible wrapper for ProcessExecutor.
 * Delegates all calls to the new ProcessExecutor implementation.
 *
 * @deprecated Use {@link com.devops.kanban.infrastructure.process.ProcessExecutor} instead.
 */
@Service
@Deprecated
public class ClaudeCodeExecutor implements ProcessExecutor {

    private final ProcessExecutor processExecutor;

    @Autowired
    public ClaudeCodeExecutor(ProcessExecutor processExecutor) {
        this.processExecutor = processExecutor;
    }

    @Override
    public boolean start(Long sessionId, String commandPath, Path workDir, String initialPrompt, String resumeSessionId) {
        return processExecutor.start(sessionId, commandPath, workDir, initialPrompt, resumeSessionId);
    }

    // Legacy method name - delegates to start
    public boolean spawn(Long sessionId, String commandPath, Path workDir, String initialPrompt, String resumeSessionId) {
        return start(sessionId, commandPath, workDir, initialPrompt, resumeSessionId);
    }

    @Override
    public boolean sendInput(Long sessionId, String input) {
        return processExecutor.sendInput(sessionId, input);
    }

    @Override
    public void stop(Long sessionId) {
        processExecutor.stop(sessionId);
    }

    @Override
    public boolean isRunning(Long sessionId) {
        return processExecutor.isRunning(sessionId);
    }

    // Legacy method names
    public boolean isAlive(Long sessionId) {
        return isRunning(sessionId);
    }

    @Override
    public String getOutput(Long sessionId) {
        return processExecutor.getOutput(sessionId);
    }

    @Override
    public int getExitCode(Long sessionId) {
        return processExecutor.getExitCode(sessionId);
    }

    @Override
    public void cleanup(Long sessionId) {
        processExecutor.cleanup(sessionId);
    }

    // Legacy method for backward compatibility
    public void persistOutput(Long sessionId) {
        processExecutor.persistOutput(sessionId);
    }
}
