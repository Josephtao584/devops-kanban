import crossSpawn from 'cross-spawn';
import { parseStepResult, validateStepResult } from './claudeStepResult.js';
import { resolveCommand } from './commandResolver.js';

const CLAUDE_DEFAULT_COMMAND = ['npx', '-y', '@anthropic-ai/claude-code@2.1.62'];

function buildClaudeCliArgs(prompt) {
  return ['-p', prompt, '--dangerously-skip-permissions'];
}

function buildClaudeSpawnCommand(executorConfig = {}, processEnv = process.env) {
  return resolveCommand({
    defaultCommand: CLAUDE_DEFAULT_COMMAND,
    executorConfig,
    processEnv,
  });
}

async function resolveCrossSpawn() {
  return crossSpawn;
}

function summarizeCommand(command, args) {
  return [command, ...args].map((arg) => JSON.stringify(arg)).join(' ');
}

async function defaultSpawnImpl({ worktreePath, prompt, onSpawn, executorConfig = {} }) {
  const cliArgs = buildClaudeCliArgs(prompt);
  const resolved = buildClaudeSpawnCommand(executorConfig);
  const spawnCommand = resolved.command;
  const commandArgs = [...resolved.args, ...cliArgs];
  const commandSummary = summarizeCommand(spawnCommand, commandArgs);
  const spawnImpl = await resolveCrossSpawn();

  console.log('[ClaudeStepRunner] Launching Claude command');
  console.log(`[ClaudeStepRunner]   cwd: ${worktreePath}`);
  console.log(`[ClaudeStepRunner]   command: ${commandSummary}`);
  console.log(`[ClaudeStepRunner]   prompt:\n${prompt}`);

  return await new Promise((resolve, reject) => {
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

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('error', reject);
    proc.on('close', async (exitCode) => {
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
  constructor({ spawnImpl = defaultSpawnImpl } = {}) {
    this.spawnImpl = spawnImpl;
  }

  _buildParseError(error, execution) {
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
  }) {
    const execution = await this.spawnImpl({
      worktreePath,
      prompt,
      executorConfig,
      onSpawn,
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
      throw this._buildParseError(error, execution);
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
