import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';

const MAX_FILE_SIZE = 1_000_000; // 1MB

function isTextContent(filePath: string): boolean {
  const BUFFER_SIZE = 8192;
  const buffer = fs.readFileSync(filePath);
  const slice = buffer.subarray(0, BUFFER_SIZE);

  if (slice.length === 0) return true;
  for (let i = 0; i < slice.length; i++) {
    if (slice[i] === 0) return false;
  }
  return true;
}

function validateFilePath(worktreePath: string, filePath: string): string {
  const normalized = path.normalize(filePath);
  if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
    throw new Error('Invalid file path');
  }
  const resolved = path.resolve(worktreePath, normalized);
  if (!resolved.startsWith(path.resolve(worktreePath))) {
    throw new Error('Path traversal detected');
  }
  return resolved;
}

export function readFileContent(worktreePath: string, filePath: string): {
  content: string;
  isBinary: boolean;
  size: number;
} {
  const fullPath = validateFilePath(worktreePath, filePath);

  if (!fs.existsSync(fullPath)) {
    const err: any = new Error(`File not found: ${filePath}`);
    err.statusCode = 404;
    throw err;
  }

  const stat = fs.statSync(fullPath);
  if (stat.size > MAX_FILE_SIZE) {
    const err: any = new Error(`File too large to edit (${(stat.size / 1024 / 1024).toFixed(1)}MB)`);
    err.statusCode = 400;
    throw err;
  }

  if (!isTextContent(fullPath)) {
    return { content: '', isBinary: true, size: stat.size };
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  return { content, isBinary: false, size: stat.size };
}

export function readHeadFileContent(worktreePath: string, filePath: string): string {
  validateFilePath(worktreePath, filePath);

  try {
    const content = execFileSync('git', ['show', `HEAD:${filePath}`], {
      cwd: worktreePath,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });
    return content;
  } catch {
    // File doesn't exist in HEAD (new file) — return empty string
    return '';
  }
}

export function writeFileContent(worktreePath: string, filePath: string, content: string): string {
  const fullPath = validateFilePath(worktreePath, filePath);

  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(fullPath, content, 'utf-8');

  // Generate diff for the changed file
  let diff = '';
  try {
    diff = execFileSync('git', ['diff', '--', filePath], {
      cwd: worktreePath,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch {
    // File might be new (untracked) — generate synthetic diff
    const lines = content.split('\n');
    diff = `--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +1,${lines.length} @@\n${lines.map(l => `+${l}`).join('\n')}\n`;
  }

  return diff;
}
