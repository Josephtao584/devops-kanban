import crossSpawn, { SpawnedProcess } from 'cross-spawn';
import { spawn } from 'node:child_process';
import { parseStepResult, validateStepResult } from './openCodeStepResult.js';
import { resolveCommand } from './commandResolver.js';
import type { ExecutorProcessHandle, WorkflowExecutionEvent } from '../../../types/executors.js';
import { buildEvent } from '../../../types/executors.js';
import { OPENCODE_COMMAND } from '../../../config/index.js';

const OPENCODE_DEFAULT_COMMAND = OPENCODE_COMMAND.split(/\s+/).filter(Boolean);

type OpenCodeRuntimeExecutorConfig = {
  commandOverride?: string;
  args?: string[];
  env?: Record<string, string>;
};

type OpenCodeSpawnExecution = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  commandSummary: string;
  cwd: string;
  prompt: string;
  proc: ExecutorProcessHandle | null;
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
  const args = ['run', '--format', 'json'];

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
    if (typeof part?.text === 'string') {
      return buildEvent('message', 'assistant', part.text);
    }
    return null;
  }

  // Step start event: capture sessionID for continue functionality
  if (type === 'step_start') {
    const sessionId = typeof json.sessionID === 'string' ? json.sessionID : undefined;
    return buildEvent('status', 'system', 'step started', {
      ...(sessionId ? { session_id: sessionId } : {}),
      part: json.part,
    });
  }

  // Step finish event: capture sessionID as fallback
  if (type === 'step_finish') {
    const sessionId = typeof json.sessionID === 'string' ? json.sessionID : undefined;
    return buildEvent('status', 'system', 'step finished', {
      ...(sessionId ? { session_id: sessionId } : {}),
      part: json.part,
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

      // Text block
      if (b.type === 'text' && typeof b.text === 'string') {
        return buildEvent('message', 'assistant', b.text);
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
  prompt,
  executorConfig = {},
  cliOptions = {},
  abortSignal,
  onEvent,
}: {
  worktreePath: string;
  prompt: string;
  executorConfig?: OpenCodeRuntimeExecutorConfig;
  cliOptions?: OpenCodeCliOptions;
  abortSignal?: AbortSignal;
  onEvent?: ((event: WorkflowExecutionEvent) => void | Promise<void>);
}) {
  const cliArgs = buildOpenCodeCliArgs(prompt, cliOptions);
  const resolved = buildOpenCodeSpawnCommand(executorConfig);
  const spawnCommand = resolved.command!;
  const commandArgs = [...resolved.args, ...cliArgs];
  const commandSummary = summarizeCommand(spawnCommand, commandArgs);

  return await new Promise<OpenCodeSpawnExecution>((resolve, reject) => {
    const spawnedProc = crossSpawn(spawnCommand, commandArgs, {
      cwd: worktreePath,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: resolved.env,
      shell: false,
    });
    const proc = toExecutorProcessHandle(spawnedProc);

    if (abortSignal) {
      if (abortSignal.aborted) {
        console.log(`[OpenCodeStepRunner] Already aborted, killing process immediately`);
        killProcessTree(proc);
      } else {
        abortSignal.addEventListener('abort', () => {
          console.log(`[OpenCodeStepRunner] Abort event received, killing process. pid: ${proc.pid}`);
          killProcessTree(proc);
        }, { once: true });
      }
    }

    let stdout = '';
    let stderr = '';

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
            Promise.resolve(onEvent(event)).catch(() => {});
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
        exitCode,
        stdout,
        stderr,
        commandSummary,
        cwd: worktreePath,
        prompt,
        proc,
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
    executorConfig,
    cliOptions,
    abortSignal,
    onEvent,
  }: {
    prompt: string;
    worktreePath: string;
    executorConfig?: OpenCodeRuntimeExecutorConfig;
    cliOptions?: OpenCodeCliOptions;
    abortSignal?: AbortSignal;
    onEvent?: ((event: WorkflowExecutionEvent) => void | Promise<void>);
  }) {
    const spawnInput: Parameters<typeof defaultSpawnImpl>[0] = {
      worktreePath,
      prompt,
    };
    if (executorConfig) spawnInput.executorConfig = executorConfig;
    if (cliOptions) spawnInput.cliOptions = cliOptions;
    if (abortSignal) spawnInput.abortSignal = abortSignal;
    if (onEvent) spawnInput.onEvent = onEvent;

    const execution = await this.spawnImpl(spawnInput);

    if (execution.exitCode !== 0) {
      throw new Error(`OpenCode step failed with exit code ${execution.exitCode}: ${execution.stderr || execution.stdout}`);
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

export { OpenCodeStepRunner, OPENCODE_DEFAULT_COMMAND };
