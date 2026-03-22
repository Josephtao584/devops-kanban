import crossSpawn from 'cross-spawn';
import { parseStepResult, validateStepResult } from './claudeStepResult.js';
import { resolveCommand } from './commandResolver.js';

const CLAUDE_DEFAULT_COMMAND = ['npx', '-y', '@anthropic-ai/claude-code@2.1.62'];

function buildClaudeCliArgs(prompt: string) {
  return ['-p', prompt, '--dangerously-skip-permissions'];
}

function buildClaudeSpawnCommand(executorConfig = {}, processEnv = process.env) {
  return resolveCommand({
    defaultCommand: CLAUDE_DEFAULT_COMMAND,
    executorConfig: executorConfig as {
      commandOverride?: string | null;
      args?: string[];
      env?: Record<string, string>;
    },
    processEnv,
  });
}

async function resolveCrossSpawn() {
  return crossSpawn;
}

function summarizeCommand(command: string, args: string[]) {
  return [command, ...args].map((arg) => JSON.stringify(arg)).join(' ');
}

async function defaultSpawnImpl({
  worktreePath,
  prompt,
  onSpawn,
  executorConfig = {},
}: {
  worktreePath: string;
  prompt: string;
  onSpawn?: ((proc: unknown) => void) | undefined;
  executorConfig?: unknown;
}) {
  const cliArgs = buildClaudeCliArgs(prompt);
  const resolved = buildClaudeSpawnCommand(executorConfig as Record<string, unknown>);
  const spawnCommand = resolved.command || 'npx';
  const commandArgs = [...resolved.args, ...cliArgs];
  const commandSummary = summarizeCommand(spawnCommand, commandArgs);
  const spawnImpl = await resolveCrossSpawn();

  return await new Promise<{
    exitCode: number | null;
    stdout: string;
    stderr: string;
    commandSummary: string;
    cwd: string;
    prompt: string;
    proc: unknown;
  }>((resolve, reject) => {
    const proc = spawnImpl(spawnCommand, commandArgs, {
      cwd: worktreePath,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: resolved.env,
      shell: false,
    });

    if (onSpawn) {
      onSpawn(proc);
    }

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data: Buffer | string) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data: Buffer | string) => {
      stderr += data.toString();
    });

    proc.on('error', reject);
    proc.on('close', async (exitCode: number | null) => {
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
  }: {
    prompt: string;
    worktreePath: string;
    executorConfig?: unknown;
    onSpawn?: ((proc: unknown) => void) | undefined;
  }) {
    const execution = await this.spawnImpl({
      worktreePath,
      prompt,
      executorConfig,
      ...(onSpawn ? { onSpawn } : {}),
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
