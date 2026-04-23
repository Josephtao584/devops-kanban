import crossSpawn, {SpawnedProcess} from 'cross-spawn';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseStepResult, validateStepResult } from './claudeStepResult.js';
import { resolveCommand } from './commandResolver.js';
import type { AskUserQuestionData, ExecutorProcessHandle, WorkflowExecutionEvent } from '../../../types/executors.js';
import { buildEvent } from '../../../types/executors.js';
import { logger } from '../../../utils/logger.js';

const CLAUDE_DEFAULT_COMMAND = ['npx', '-y', '@anthropic-ai/claude-code@2.1.62'];

type ClaudeRuntimeExecutorConfig = { commandOverride?: string; args?: string[]; env?: Record<string, string> | undefined };

type ClaudeSpawnExecution = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  commandSummary: string;
  cwd: string;
  prompt: string;
  proc: ExecutorProcessHandle | null;
  askUserQuestion?: AskUserQuestionData | null | undefined;
};

/**
 * Kill a process and all its children (process tree).
 * On Windows, uses taskkill to kill the entire process tree.
 */
function killProcessTree(proc: ExecutorProcessHandle): boolean {
  const pid = proc.pid;
  if (!pid) return false;

  if (process.platform === 'win32') {
    // On Windows, use taskkill to kill the entire process tree
    spawn('taskkill', ['/pid', String(pid), '/t', '/f'], {
      stdio: 'ignore',
      detached: true,
    });
    return true;
  } else {
    // On Unix, SIGTERM should propagate to the process group
    return proc.kill?.('SIGTERM') ?? false;
  }
}

function buildClaudeCliArgs(prompt: string) {
  return [
    '-p', prompt,
    '--dangerously-skip-permissions',
    '--output-format', 'stream-json',
    '--verbose',
  ];
}

function buildClaudeSpawnCommand(executorConfig: ClaudeRuntimeExecutorConfig = {}, processEnv = process.env) {
  return resolveCommand({
    defaultCommand: CLAUDE_DEFAULT_COMMAND,
    executorConfig,
    processEnv,
  });
}

async function resolveCrossSpawn() {
  return crossSpawn;
}

function summarizeCommand(command: string, args: string[]) {
  return [command, ...args].map((arg) => JSON.stringify(arg)).join(' ');
}

function toExecutorProcessHandle(proc: SpawnedProcess): ExecutorProcessHandle {
  if (proc === null) {
    return {};
  }

  const handle: ExecutorProcessHandle = {};
  const pid = Reflect.get(proc, 'pid');
  if (typeof pid === 'number') {
    handle.pid = pid;
  }

  const kill = Reflect.get(proc, 'kill');
  if (typeof kill === 'function') {
    handle.kill = (signal) => Reflect.apply(kill, proc, [signal]) as boolean;
  }

  return handle;
}

export function parseStreamEvent(json: Record<string, unknown>): WorkflowExecutionEvent | null {
  const type = json.type;

  // System init event
  if (type === 'system') {
    const sessionId = json.session_id;
    if (typeof sessionId === 'string') {
      return buildEvent('status', 'system', `session: ${sessionId}`, { session_id: sessionId });
    }
    return null;
  }

  // Assistant message
  if (type === 'assistant') {
    const message = json.message as Record<string, unknown> | undefined;
    const content = message?.content as unknown[] | undefined;
    if (!Array.isArray(content)) return null;

    for (const block of content) {
      if (typeof block !== 'object' || block === null) continue;
      const b = block as Record<string, unknown>;

      // Thinking block
      if (b.type === 'thinking' && typeof b.thinking === 'string') {
        return buildEvent('message', 'assistant', b.thinking, { block_type: 'thinking' });
      }

      // Text block
      if (b.type === 'text' && typeof b.text === 'string') {
        return buildEvent('message', 'assistant', b.text);
      }

      // Tool use
      if (b.type === 'tool_use') {
        const toolName = typeof b.name === 'string' ? b.name : 'unknown';

        // Special handling for AskUserQuestion
        if (toolName === 'AskUserQuestion') {
          const input = b.input as Record<string, unknown> | undefined;
          const questions = Array.isArray(input?.questions) ? input.questions : [];
          return buildEvent('ask_user', 'assistant', 'AskUserQuestion', {
            tool_name: toolName,
            tool_id: b.id,
            input: b.input,
            ask_user_question: {
              tool_use_id: typeof b.id === 'string' ? b.id : '',
              questions,
            },
          });
        }

        return buildEvent('tool_call', 'assistant', toolName, {
          tool_name: toolName,
          tool_id: b.id,
          input: b.input,
        });
      }
    }
    return null;
  }

  // User message (tool_result)
  if (type === 'user') {
    const message = json.message as Record<string, unknown> | undefined;
    const content = message?.content as unknown[] | undefined;
    if (!Array.isArray(content)) return null;

    for (const block of content) {
      if (typeof block !== 'object' || block === null) continue;
      const b = block as Record<string, unknown>;

      if (b.type === 'tool_result') {
        const toolUseId = b.tool_use_id;
        const toolResult = typeof b.content === 'string' ? b.content : JSON.stringify(b.content);
        return buildEvent('tool_result', 'tool', toolResult.substring(0, 500), {
          tool_use_id: toolUseId,
          is_error: b.is_error,
        });
      }
    }
    return null;
  }

  // Result event - only emit status, actual message already emitted via 'assistant' event
  if (type === 'result') {
    return buildEvent('status', 'system', 'completed', {
      duration_ms: json.duration_ms,
      total_cost_usd: json.total_cost_usd,
      stop_reason: json.stop_reason,
    });
  }

  // Error event
  if (type === 'error') {
    const error = json.error as Record<string, unknown> | undefined;
    const message = typeof error?.message === 'string' ? error.message : 'Unknown error';
    return buildEvent('error', 'system', message, { error });
  }

  return null;
}

async function defaultSpawnImpl({
  worktreePath,
  prompt,
  executorConfig = {},
  abortSignal,
  onEvent,
  onAskUser,
}: {
  worktreePath: string;
  prompt: string;
  executorConfig?: ClaudeRuntimeExecutorConfig | undefined;
  abortSignal?: AbortSignal;
  onEvent?: ((event: WorkflowExecutionEvent) => void | Promise<void>) | undefined;
  onAskUser?: ((data: AskUserQuestionData) => void | Promise<void>) | undefined;
}) {
  const cliArgs = buildClaudeCliArgs(prompt);
  const resolved = buildClaudeSpawnCommand(executorConfig);
  const spawnCommand = resolved.command || 'npx';
  const commandArgs = [...resolved.args, ...cliArgs];

  // Auto-detect .mcp.json in worktree and pass to Claude Code explicitly
  const mcpConfigPath = resolve(worktreePath, '.mcp.json');
  if (existsSync(mcpConfigPath)) {
    commandArgs.push('--mcp-config', mcpConfigPath);
  }
  const commandSummary = summarizeCommand(spawnCommand, commandArgs);
  const spawnImpl = await resolveCrossSpawn();

  return await new Promise<ClaudeSpawnExecution>((resolve, reject) => {
    const spawnedProc = spawnImpl(spawnCommand, commandArgs, {
      cwd: worktreePath,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: resolved.env,
      shell: false,
    });
    const proc = toExecutorProcessHandle(spawnedProc);

    let killedByAskUser = false;
    let capturedAskUserQuestion: AskUserQuestionData | null = null;

    if (abortSignal) {
      if (abortSignal.aborted) {
        // Stale abort signal from a cancelled Mastra Run — Mastra reuses the cached
        // Run instance whose AbortController was already aborted during cancel().
        // Do NOT kill the process; let the retry execution proceed normally.
        logger.warn('ClaudeStepRunner', `Abort signal already set (stale from cancelled run), ignoring to allow retry. pid: ${proc.pid}`);
      } else {
        const abortHandler = () => {
          logger.info('ClaudeStepRunner', `Abort event received, killing process. pid: ${proc.pid}`);
          killProcessTree(proc);
        };
        abortSignal.addEventListener('abort', abortHandler, { once: true });
        spawnedProc.on('close', () => abortSignal.removeEventListener('abort', abortHandler));
      }
    }

    let stdout = '';
    let stderr = '';

    spawnedProc.stdout?.on('data', (data: Buffer | string) => {
      const chunk = data.toString();
      stdout += chunk;

      // Parse each line as JSON event
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          const event = parseStreamEvent(json);
          if (event && onEvent) {
            Promise.resolve(onEvent(event)).catch((err) => {
              logger.warn('ClaudeStepRunner', `onEvent failed: ${err instanceof Error ? err.message : String(err)}`);
            });
          }

          // Detect AskUserQuestion and kill process (guard against re-entry after kill)
          if (!killedByAskUser && event?.kind === 'ask_user') {
            const questionData = event.payload?.ask_user_question as AskUserQuestionData | undefined;
            if (questionData) {
              capturedAskUserQuestion = questionData;
              killedByAskUser = true;
              if (onAskUser) {
                Promise.resolve(onAskUser(questionData)).catch((err) => {
                  logger.warn('ClaudeStepRunner', `onAskUser failed: ${err instanceof Error ? err.message : String(err)}`);
                });
              }
              logger.info('ClaudeStepRunner', `AskUserQuestion detected, killing process. pid: ${proc.pid}`);
              killProcessTree(proc);
            }
          }
        } catch {
          // Not valid JSON, ignore
        }
      }
    });

    spawnedProc.stderr?.on('data', (data: Buffer | string) => {
      stderr += data.toString();
    });

    spawnedProc.on('error', reject);
    spawnedProc.on('close', async (exitCode: number | null) => {
      resolve({
        exitCode: killedByAskUser ? 0 : exitCode,
        stdout,
        stderr,
        commandSummary,
        cwd: worktreePath,
        prompt,
        proc,
        askUserQuestion: killedByAskUser ? capturedAskUserQuestion : undefined,
      });
    });
  });
}

class ClaudeStepRunner {
  spawnImpl: typeof defaultSpawnImpl;

  constructor({ spawnImpl = defaultSpawnImpl }: { spawnImpl?: typeof defaultSpawnImpl } = {}) {
    this.spawnImpl = spawnImpl;
  }

  _buildParseError(error: Error, execution: { commandSummary?: string; cwd?: string; prompt?: string; stdout?: string; stderr?: string }) {
    const command = execution.commandSummary ? `\n[command]\n${execution.commandSummary}` : '';
    const cwd = execution.cwd ? `\n[cwd]\n${execution.cwd}` : '';
    const prompt = execution.prompt ? `\n[prompt]\n${execution.prompt}` : '';
    const stdout = execution.stdout ? `\n[stdout]\n${execution.stdout}` : '';
    const stderr = execution.stderr ? `\n[stderr]\n${execution.stderr}` : '';
    return new Error(`${error.message}${command}${cwd}${prompt}${stdout}${stderr}`);
  }

  async runStep({
    prompt,
    worktreePath,
    executorConfig = {},
    abortSignal,
    onEvent,
    onAskUser,
  }: {
    prompt: string;
    worktreePath: string;
    executorConfig?: ClaudeRuntimeExecutorConfig | undefined;
    abortSignal?: AbortSignal;
    onEvent?: ((event: WorkflowExecutionEvent) => void | Promise<void>) | undefined;
    onAskUser?: ((data: AskUserQuestionData) => void | Promise<void>) | undefined;
  }) {
    const execution = await this.spawnImpl({
      worktreePath,
      prompt,
      executorConfig,
      ...(abortSignal ? { abortSignal } : {}),
      ...(onEvent ? { onEvent } : {}),
      ...(onAskUser ? { onAskUser } : {}),
    });

    // If AskUserQuestion was triggered, throw a specific error for the workflow to catch
    if (execution.askUserQuestion) {
      const error: any = new Error('STEP_AWAITING_USER_INPUT');
      error.askUserQuestion = execution.askUserQuestion;
      throw error;
    }

    if (execution.exitCode !== 0) {
      const parts = [execution.stderr, execution.stdout].filter(Boolean);
      throw new Error(`Claude step failed with exit code ${execution.exitCode}: ${parts.join('\n')}`);
    }

    let parsedResult;
    try {
      parsedResult = validateStepResult(await parseStepResult({
        stdout: execution.stdout,
      }));
    } catch (error) {
      throw this._buildParseError(error as Error, execution);
    }

    return {
      exitCode: execution.exitCode,
      stdout: execution.stdout,
      stderr: execution.stderr,
      parsedResult,
      proc: execution.proc,
    };
  }
}

export { ClaudeStepRunner, CLAUDE_DEFAULT_COMMAND, buildClaudeCliArgs, buildClaudeSpawnCommand, resolveCrossSpawn };
