import { ClaudeStepRunner } from './claudeStepRunner.js';
import { ExecutionEventSink } from '../executionEventSink.js';
import type { Executor, ExecutorExecutionInput, ExecutorContinueInput, ExecutorExecutionResult } from '../../../types/executors.js';

class ClaudeCodeExecutor implements Executor {
  runner: ClaudeStepRunner;

  constructor({ runner = new ClaudeStepRunner() }: { runner?: ClaudeStepRunner } = {}) {
    this.runner = runner;
  }

  async execute({
    prompt,
    worktreePath,
    onSpawn,
    onEvent,
    onProviderState,
    abortSignal,
  }: ExecutorExecutionInput): Promise<ExecutorExecutionResult> {
    const sink = new ExecutionEventSink({ onEvent, onProviderState });
    const result = await this.runner.runStep({
      prompt,
      worktreePath,
      onStreamChunk: async (content, stream) => {
        if (stream === 'stderr') {
          await sink.appendStreamChunk(content, 'stderr');
          return;
        }
        try {
          const json = JSON.parse(content.trim());
          if (json.type === 'system' && json.session_id && onProviderState) {
            await onProviderState({ providerSessionId: json.session_id });
          }
          await sink.appendStreamChunk(content, 'stdout');
        } catch {
          await sink.appendStreamChunk(content, 'stdout');
        }
      },
      ...(onSpawn ? { onSpawn } : {}),
      ...(abortSignal ? { abortSignal } : {}),
    });

    if (result.stdout) {
      await sink.appendStreamChunk(result.stdout, 'stdout');
    }

    if (result.stderr) {
      await sink.appendStreamChunk(result.stderr, 'stderr');
    }

    const summary = result.parsedResult.summary.trim();
    if (summary && summary !== result.stdout.trim()) {
      await sink.appendMessage(result.parsedResult.summary);
    }

    return {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      proc: result.proc,
      rawResult: result.parsedResult,
    };
  }

  async continue({
    prompt,
    worktreePath,
    providerSessionId,
    onSpawn,
    onEvent,
    onProviderState,
    abortSignal,
  }: ExecutorContinueInput): Promise<ExecutorExecutionResult> {
    const sink = new ExecutionEventSink({ onEvent, onProviderState });
    const args = ['--output-format=stream-json', '--verbose'];
    if (providerSessionId) {
      args.push('--session-id', providerSessionId);
    }

    const result = await this.runner.runStep({
      prompt,
      worktreePath,
      executorConfig: { args },
      ...(onSpawn ? { onSpawn } : {}),
      ...(abortSignal ? { abortSignal } : {}),
    });

    const lines = result.stdout.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        if (json.type === 'system' && json.session_id && onProviderState) {
          await onProviderState({ providerSessionId: json.session_id });
        }
      } catch {}
      await sink.appendStreamChunk(line, 'stdout');
    }

    if (result.stderr) {
      await sink.appendStreamChunk(result.stderr, 'stderr');
    }

    const summary = result.parsedResult.summary.trim();
    if (summary && summary !== result.stdout.trim()) {
      await sink.appendMessage(result.parsedResult.summary);
    }

    return {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      proc: result.proc,
      rawResult: result.parsedResult,
    };
  }
}

export { ClaudeCodeExecutor };
