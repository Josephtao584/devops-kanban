import crossSpawn from 'cross-spawn';
import { parseStepResult, validateStepResult } from './claudeStepResult.js';
import { resolveCommand } from './commandResolver.js';
import type { ExecutorConfig, ExecutorProcessHandle } from '../../../types/executors.js';

const CLAUDE_DEFAULT_COMMAND = ['npx', '-y', '@anthropic-ai/claude-code@2.1.62'];

type ClaudeRuntimeExecutorConfig = Pick<ExecutorConfig, 'commandOverride' | 'args' | 'env'>;

type ClaudeSpawnExecution = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  commandSummary: string;
  cwd: string;
  prompt: string;
  proc: ExecutorProcessHandle | null;
};

function buildClaudeCliArgs(prompt: string) {
  return ['-p', prompt, '--dangerously-skip-permissions'];
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

function toExecutorProcessHandle(proc: unknown): ExecutorProcessHandle {
  if (typeof proc !== 'object' || proc === null) {
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

async function defaultSpawnImpl({
  worktreePath,
  prompt,
  onSpawn,
  executorConfig = {},
  abortSignal,
}: {
  worktreePath: string;
  prompt: string;
  onSpawn?: ((proc: ExecutorProcessHandle) => void) | undefined;
  executorConfig?: ClaudeRuntimeExecutorConfig | undefined;
  abortSignal?: AbortSignal;
}) {
  const cliArgs = buildClaudeCliArgs(prompt);
  const resolved = buildClaudeSpawnCommand(executorConfig);
  const spawnCommand = resolved.command || 'npx';
  const commandArgs = [...resolved.args, ...cliArgs];
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

    onSpawn?.(proc);

    if (abortSignal) {
      if (abortSignal.aborted) {
        proc.kill?.('SIGTERM');
      } else {
        abortSignal.addEventListener('abort', () => {
          proc.kill?.('SIGTERM');
        }, { once: true });
      }
    }

    let stdout = '';
    let stderr = '';

    spawnedProc.stdout?.on('data', (data: Buffer | string) => {
      stdout += data.toString();
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
    onSpawn,
    abortSignal,
  }: {
    prompt: string;
    worktreePath: string;
    executorConfig?: ClaudeRuntimeExecutorConfig | undefined;
    onSpawn?: ((proc: ExecutorProcessHandle) => void) | undefined;
    abortSignal?: AbortSignal;
  }) {
    const execution = await this.spawnImpl({
      worktreePath,
      prompt,
      executorConfig,
      ...(onSpawn ? { onSpawn } : {}),
      ...(abortSignal ? { abortSignal } : {}),
    });

    if (execution.exitCode !== 0) {
      throw new Error(`Claude step failed with exit code ${execution.exitCode}: ${execution.stderr || execution.stdout}`);
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
