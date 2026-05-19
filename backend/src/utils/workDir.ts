import { isAbsolute, join, normalize, sep } from 'node:path';

import { ValidationError } from './errors.js';

const CONTROL_CHAR_REGEX = /[\x00-\x1f\x7f]/;

/**
 * Normalize a user-provided `work_dir` to a safe relative subpath, or return
 * `null` for empty / whitespace input. Throws ValidationError for any value
 * that could escape the worktree (absolute path, `..`, drive letters, control
 * characters).
 */
export function sanitizeWorkDir(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string') {
    throw new ValidationError(
      'work_dir 必须是字符串',
      'work_dir must be a string',
      { value: raw },
    );
  }

  const trimmed = raw.trim();
  if (trimmed === '') return null;

  if (CONTROL_CHAR_REGEX.test(trimmed)) {
    throw new ValidationError(
      'work_dir 不能包含控制字符',
      'work_dir contains control characters',
      { value: trimmed },
    );
  }

  // Reject Windows-style drive letters (`C:foo`) — POSIX `isAbsolute` misses them.
  if (/^[a-zA-Z]:/.test(trimmed)) {
    throw new ValidationError(
      'work_dir 不能是绝对路径',
      'work_dir must be a relative path',
      { value: trimmed },
    );
  }

  if (isAbsolute(trimmed) || trimmed.startsWith('/') || trimmed.startsWith('\\')) {
    throw new ValidationError(
      'work_dir 不能是绝对路径',
      'work_dir must be a relative path',
      { value: trimmed },
    );
  }

  // Normalize backslashes to forward slashes for cross-platform consistency
  // before checking for `..` segments.
  const unified = trimmed.replace(/\\/g, '/');
  const normalized = normalize(unified);
  const segments = normalized.split(/[\\/]/);
  if (segments.some((seg) => seg === '..')) {
    throw new ValidationError(
      'work_dir 不能包含 ".." 路径段',
      'work_dir must not contain ".." segments',
      { value: trimmed },
    );
  }

  // Strip any leading `./` or trailing slashes that `normalize` may leave.
  const cleaned = normalized.replace(/^\.\/+/, '').replace(/\/+$/, '');
  return cleaned === '' || cleaned === '.' ? null : cleaned;
}

/**
 * Join `executionPath` with a sanitized `workDir`, returning the resulting
 * absolute path. Throws ValidationError if the join would resolve outside
 * `executionPath` (defense-in-depth on top of `sanitizeWorkDir`).
 */
export function joinWorkDir(executionPath: string, workDir: string | null | undefined): string {
  const sanitized = sanitizeWorkDir(workDir);
  if (!sanitized) return executionPath;

  const joined = join(executionPath, sanitized);
  const rootWithSep = executionPath.endsWith(sep) ? executionPath : executionPath + sep;
  if (joined !== executionPath && !joined.startsWith(rootWithSep)) {
    throw new ValidationError(
      'work_dir 解析后超出工作目录范围',
      'work_dir resolves outside the worktree',
      { executionPath, workDir },
    );
  }

  return joined;
}
