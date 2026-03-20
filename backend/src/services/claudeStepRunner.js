import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { buildStepPrompt } from './claudeStepPromptBuilder.js';
import { parseStepResult, validateStepResult } from './claudeStepResult.js';

async function prepareStepResultFile(worktreePath) {
  const resultDirPath = path.join(worktreePath, '.kanban');
  const resultFilePath = path.join(resultDirPath, 'step-result.json');

  await fs.mkdir(resultDirPath, { recursive: true });
  await fs.rm(resultFilePath, { force: true });

  return resultFilePath;
}

function buildClaudeCliArgs(prompt) {
  return ['-p', prompt, '--dangerously-skip-permissions'];
}

function buildClaudeSpawnCommand(platform = process.platform) {
  return platform === 'win32' ? 'claude' : 'claude';
}

function summarizeCommand(args) {
  return args.map((arg) => JSON.stringify(arg)).join(' ');
}

async function defaultSpawnImpl({ worktreePath, prompt, onSpawn }) {
  const resultFilePath = await prepareStepResultFile(worktreePath);
  const commandArgs = buildClaudeCliArgs(prompt);
  const commandSummary = summarizeCommand(commandArgs);
  const spawnCommand = buildClaudeSpawnCommand();

  console.log('[ClaudeStepRunner] Launching Claude command');
  console.log(`[ClaudeStepRunner]   cwd: ${worktreePath}`);
  console.log(`[ClaudeStepRunner]   command: ${commandSummary}`);
  console.log(`[ClaudeStepRunner]   prompt:\n${prompt}`);

  return await new Promise((resolve, reject) => {
    const proc = spawn(spawnCommand, commandArgs, {
      cwd: worktreePath,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
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
      let resultFileContent = '';
      try {
        resultFileContent = await fs.readFile(resultFilePath, 'utf-8');
      } catch {
        resultFileContent = '';
      }

      resolve({
        exitCode,
        stdout,
        stderr,
        resultFileContent,
        resultFilePath,
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
    stepId,
    worktreePath,
    taskTitle,
    taskDescription,
    previousSummary = '',
    onSpawn,
  }) {
    const prompt = buildStepPrompt({
      stepId,
      taskTitle,
      taskDescription,
      worktreePath,
      previousSummary,
    });

    const execution = await this.spawnImpl({
      stepId,
      worktreePath,
      prompt,
      onSpawn,
    });

    if (execution.exitCode !== 0) {
      throw new Error(`Claude step failed with exit code ${execution.exitCode}: ${execution.stderr || execution.stdout}`);
    }

    let parsedResult;
    try {
      parsedResult = validateStepResult(await parseStepResult({
        resultFileContent: execution.resultFileContent,
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
      resultFilePath: execution.resultFilePath,
      proc: execution.proc,
    };
  }
}

export { ClaudeStepRunner, prepareStepResultFile, buildClaudeCliArgs, buildClaudeSpawnCommand };
