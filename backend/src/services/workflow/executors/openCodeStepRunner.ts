import crossSpawn, { SpawnedProcess } from 'cross-spawn';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { parseStepResult, validateStepResult } from './openCodeStepResult.js';
import { resolveCommand } from './commandResolver.js';
import type { ExecutorProcessHandle, WorkflowExecutionEvent, AskUserQuestionData } from '../../../types/executors.js';
import { buildEvent } from '../../../types/executors.js';
import { OPENCODE_COMMAND } from '../../../config/index.js';
import { logger } from '../../../utils/logger.js';
import { registerActiveProcess } from '../../../utils/processRegistry.js';

const OPENCODE_DEFAULT_COMMAND = OPENCODE_COMMAND.split(/\s+/).filter(Boolean);

const ASK_USER_REGEX = /\[ASK_USER\]\s*([\s\S]*?)\s*\[\/ASK_USER\]/;

function parseAskUserMarker(text: string): WorkflowExecutionEvent | null {
  const match = text.match(ASK_USER_REGEX);
  if (!match || !match[1]) return null;

  try {
    const raw: Record<string, unknown> = JSON.parse(match[1]);
    const toolUseId = typeof raw.tool_use_id === 'string' ? raw.tool_use_id : '';
    const questions = Array.isArray(raw.questions) ? raw.questions : [];
    return buildEvent('ask_user', 'assistant', 'AskUserQuestion', {
      tool_name: 'AskUserQuestion',
      tool_id: toolUseId,
      input: raw,
      ask_user_question: {
        tool_use_id: toolUseId,
        questions,
      },
    });
  } catch {
    return null;
  }
}

type OpenCodeRuntimeExecutorConfig = {
  commandOverride?: string;
  args?: string[];
  env?: Record<string, string> | undefined;
};

type OpenCodeSpawnExecution = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  commandSummary: string;
  cwd: string;
  prompt: string;
  proc: ExecutorProcessHandle | null;
  askUserQuestion?: AskUserQuestionData | undefined;
};

type OpenCodeCliOptions = {
  model?: string;
  session?: string;
};

function killProcessTree(proc: ExecutorProcessHandle): boolean {
  const pid = proc.pid;
  if (!pid) return false;

  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(pid), '/t', '/f'], {
      stdio: 'ignore',
      detached: true,
      windowsHide: true,
    });
    return true;
  } else {
    return proc.kill?.('SIGTERM') ?? false;
  }
}

/**
 * Validate model format to prevent command injection.
 * Allowed: alphanumeric, slash, underscore, hyphen, colon, dot (e.g., "anthropic/claude-3.7-sonnet")
 */
function validateModelFormat(model: string): boolean {
  return /^[a-zA-Z0-9/_\-:.]+$/.test(model);
}

/**
 * Build OpenCode CLI arguments for spawning.
 * @param prompt - The prompt to send to OpenCode
 * @param options - Optional model and session parameters
 * @throws Error if model format is invalid
 */
export function buildOpenCodeCliArgs(prompt: string, options: OpenCodeCliOptions = {}): string[] {
  // --thinking: always enabled so reasoning events are emitted (matching Claude Code behavior)
  const args = ['run', '--format', 'json', '--thinking'];

  if (options.model) {
    if (!validateModelFormat(options.model)) {
      throw new Error(`Invalid model format: ${options.model}. Expected format: provider/model-name`);
    }
    args.push('--model', options.model);
  }

  if (options.session) {
    args.push('--session', options.session);
  }

  args.push(prompt);
  return args;
}

export function buildOpenCodeSpawnCommand(
  executorConfig: OpenCodeRuntimeExecutorConfig = {},
  processEnv: NodeJS.ProcessEnv = process.env,
) {
  return resolveCommand({
    defaultCommand: OPENCODE_DEFAULT_COMMAND,
    executorConfig,
    processEnv,
  });
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

  // Text event: content is in part.text
  if (type === 'text') {
    const part = json.part as Record<string, unknown> | undefined;
    if (typeof part?.text === 'string' && part.text.trim()) {
      const askUserEvent = parseAskUserMarker(part.text);
      if (askUserEvent) return askUserEvent;
      // Suppress text that contains unparseable [ASK_USER] markers
      if (ASK_USER_REGEX.test(part.text)) return null;
      return buildEvent('message', 'assistant', part.text);
    }
    return null;
  }

  // Reasoning event: emitted with --thinking flag, content in part.text
  if (type === 'reasoning') {
    const part = json.part as Record<string, unknown> | undefined;
    if (typeof part?.text === 'string' && part.text.trim()) {
      return buildEvent('message', 'assistant', part.text, { block_type: 'thinking' });
    }
    return null;
  }

  // Step start event: capture sessionID for continue functionality
  if (type === 'step_start') {
    const sessionId = typeof json.sessionID === 'string' ? json.sessionID : undefined;
    return buildEvent('status', 'system', 'step started', {
      ...(sessionId ? { session_id: sessionId } : {}),
      step_type: 'step_start',
    });
  }

  // Step finish event: capture sessionID as fallback
  if (type === 'step_finish') {
    const sessionId = typeof json.sessionID === 'string' ? json.sessionID : undefined;
    return buildEvent('status', 'system', 'step finished', {
      ...(sessionId ? { session_id: sessionId } : {}),
      step_type: 'step_finish',
    });
  }

  // Tool use event: OpenCode CLI outputs tool calls as top-level tool_use events
  // with both input and output in part.state
  if (type === 'tool_use') {
    const part = json.part as Record<string, unknown> | undefined;
    if (!part) return null;
    const toolName = typeof part.tool === 'string' ? part.tool : 'unknown';
    const callId = typeof part.callID === 'string' ? part.callID : undefined;
    const state = part.state as Record<string, unknown> | undefined;
    const input = state?.input as Record<string, unknown> | undefined;
    const output = typeof state?.output === 'string' ? state.output : undefined;
    const isError = state?.status === 'error';

    return buildEvent('tool_call', 'assistant', toolName, {
      tool_name: toolName,
      tool_id: callId,
      input,
      output: output ? output.substring(0, 2000) : undefined,
      is_error: isError,
    });
  }

  // Assistant message (OpenCode standard format)
  if (type === 'assistant') {
    const message = json.message as Record<string, unknown> | undefined;
    const content = message?.content as unknown[] | undefined;
    if (!Array.isArray(content)) return null;

    for (const block of content) {
      if (typeof block !== 'object' || block === null) continue;
      const b = block as Record<string, unknown>;

      // Text block (skip empty or whitespace-only)
      if (b.type === 'text' && typeof b.text === 'string') {
        if (b.text.trim()) {
          const askUserEvent = parseAskUserMarker(b.text);
          if (askUserEvent) return askUserEvent;
          // Suppress text that contains unparseable [ASK_USER] markers
          if (ASK_USER_REGEX.test(b.text)) return null;
          return buildEvent('message', 'assistant', b.text);
        }
        continue;
      }

      // Tool use
      if (b.type === 'tool_use') {
        const toolName = typeof b.name === 'string' ? b.name : 'unknown';
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
        const toolResult = typeof b.content === 'string' ? b.content : JSON.stringify(b.content);
        return buildEvent('tool_result', 'tool', toolResult.substring(0, 500), {
          tool_use_id: b.tool_use_id,
          is_error: b.is_error,
        });
      }
    }
    return null;
  }

  // Result event (OpenCode standard)
  if (type === 'result') {
    return buildEvent('status', 'system', 'completed', {
      result: json.result,
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

function summarizeCommand(command: string, args: string[]) {
  return [command, ...args].map((arg) => JSON.stringify(arg)).join(' ');
}

async function defaultSpawnImpl({
  worktreePath,
  cwdSubdir,
  prompt,
  executorConfig = {},
  cliOptions = {},
  abortSignal,
  onEvent,
  onAskUser,
}: {
  worktreePath: string;
  cwdSubdir?: string | undefined;
  prompt: string;
  executorConfig?: OpenCodeRuntimeExecutorConfig;
  cliOptions?: OpenCodeCliOptions;
  abortSignal?: AbortSignal;
  onEvent?: ((event: WorkflowExecutionEvent) => void | Promise<void>);
  onAskUser?: ((data: AskUserQuestionData) => void | Promise<void>);
}) {
  const cliArgs = buildOpenCodeCliArgs(prompt, cliOptions);
  const resolved = buildOpenCodeSpawnCommand(executorConfig);
  const spawnCommand = resolved.command!;
  const commandArgs = [...resolved.args, ...cliArgs];
  const commandSummary = summarizeCommand(spawnCommand, commandArgs);

  const effectiveCwd = cwdSubdir ? join(worktreePath, cwdSubdir) : worktreePath;

  if (!existsSync(effectiveCwd)) {
    throw new Error(
      cwdSubdir
        ? `工作路径不存在：${effectiveCwd}（任务配置的 work_dir="${cwdSubdir}" 在 worktree 中找不到，请检查任务的工作路径）`
        : `工作路径不存在：${effectiveCwd}`,
    );
  }

  return await new Promise<OpenCodeSpawnExecution>((resolve, reject) => {
    const spawnedProc = crossSpawn(spawnCommand, commandArgs, {
      cwd: effectiveCwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: resolved.env,
      shell: false,
      // Windows: detach from parent's console group so this child's CTRL_C / CTRL_BREAK
      // (or any of its grandchildren's) cannot bounce back into the backend process.
      // No-op on POSIX since signals there are addressed by pid, not console group.
      windowsHide: true,
      detached: process.platform === 'win32',
    });
    const proc = toExecutorProcessHandle(spawnedProc);
    registerActiveProcess(spawnedProc as unknown as import('node:child_process').ChildProcess);

    if (abortSignal) {
      if (abortSignal.aborted) {
        // Stale abort signal from a cancelled Mastra Run — Mastra reuses the cached
        // Run instance whose AbortController was already aborted during cancel().
        // Do NOT kill the process; let the retry execution proceed normally.
        logger.warn('OpenCodeStepRunner', `Abort signal already set (stale from cancelled run), ignoring to allow retry. pid: ${proc.pid}`);
      } else {
        const abortHandler = () => {
          logger.info('OpenCodeStepRunner', `Abort event received, killing process. pid: ${proc.pid}`);
          killProcessTree(proc);
        };
        abortSignal.addEventListener('abort', abortHandler, { once: true });
        spawnedProc.on('close', () => abortSignal.removeEventListener('abort', abortHandler));
      }
    }

    let stdout = '';
    let stderr = '';
    let killedByAskUser = false;
    let capturedAskUserQuestion: AskUserQuestionData | undefined;

    spawnedProc.stdout?.on('data', (data: Buffer | string) => {
      const chunk = data.toString();
      stdout += chunk;

      const lines = chunk.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          const event = parseStreamEvent(json);
          if (event && onEvent) {
            Promise.resolve(onEvent(event)).catch((err) => {
              logger.warn('OpenCodeStepRunner', `onEvent failed: ${err instanceof Error ? err.message : String(err)}`);
            });
          }

          // Detect [ASK_USER] marker and kill process
          if (!killedByAskUser && event?.kind === 'ask_user') {
            const questionData = event.payload?.ask_user_question as AskUserQuestionData | undefined;
            if (questionData) {
              capturedAskUserQuestion = questionData;
              killedByAskUser = true;
              if (onAskUser) {
                Promise.resolve(onAskUser(questionData)).catch((err) => {
                  logger.warn('OpenCodeStepRunner', `onAskUser failed: ${err instanceof Error ? err.message : String(err)}`);
                });
              }
              logger.info('OpenCodeStepRunner', `AskUserQuestion detected, killing process. pid: ${proc.pid}`);
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

class OpenCodeStepRunner {
  spawnImpl: typeof defaultSpawnImpl;

  constructor({ spawnImpl = defaultSpawnImpl }: { spawnImpl?: typeof defaultSpawnImpl } = {}) {
    this.spawnImpl = spawnImpl;
  }

  _buildParseError(
    error: Error,
    execution: { commandSummary?: string; cwd?: string; prompt?: string; stdout?: string; stderr?: string },
  ) {
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
    cwdSubdir,
    executorConfig,
    cliOptions,
    abortSignal,
    onEvent,
    onAskUser,
    validateResult = true,
  }: {
    prompt: string;
    worktreePath: string;
    cwdSubdir?: string | undefined;
    executorConfig?: OpenCodeRuntimeExecutorConfig;
    cliOptions?: OpenCodeCliOptions;
    abortSignal?: AbortSignal;
    onEvent?: ((event: WorkflowExecutionEvent) => void | Promise<void>);
    onAskUser?: ((data: AskUserQuestionData) => void | Promise<void>);
    validateResult?: boolean;
  }) {
    const spawnInput: Parameters<typeof defaultSpawnImpl>[0] = {
      worktreePath,
      prompt,
    };
    if (cwdSubdir) spawnInput.cwdSubdir = cwdSubdir;
    if (executorConfig) spawnInput.executorConfig = executorConfig;
    if (cliOptions) spawnInput.cliOptions = cliOptions;
    if (abortSignal) spawnInput.abortSignal = abortSignal;
    if (onEvent) spawnInput.onEvent = onEvent;
    if (onAskUser) spawnInput.onAskUser = onAskUser;

    const execution = await this.spawnImpl(spawnInput);

    // If AskUserQuestion was triggered, throw for workflow to catch
    if (execution.askUserQuestion) {
      const error: any = new Error('STEP_AWAITING_USER_INPUT');
      error.askUserQuestion = execution.askUserQuestion;
      throw error;
    }

    if (execution.exitCode !== 0) {
      throw new Error(`OpenCode step failed with exit code ${execution.exitCode}: ${execution.stderr || execution.stdout}`);
    }

    let parsedResult;
    try {
      const parsed = await parseStepResult({ stdout: execution.stdout });
      parsedResult = validateResult ? validateStepResult(parsed) : { summary: parsed.summary?.trim() ?? '' };
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

export { OpenCodeStepRunner, OPENCODE_DEFAULT_COMMAND };
