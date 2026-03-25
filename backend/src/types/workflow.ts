import type { ExecutorType } from './executors.js';

export interface WorkflowSharedState {
  taskTitle: string;
  taskDescription: string;
  worktreePath: string;
}

export interface WorkflowStepSummary {
  summary: string;
}

export interface WorkflowExecutionContext {
  cancelled: boolean;
  proc: unknown;
  worktreePath: string;
}

export interface WorkflowTaskRecord {
  id: number;
  project_id: number;
  title?: string | undefined;
  description?: string | undefined;
  worktree_path?: string | null;
  worktree_branch?: string | null;
}

export interface WorkflowAgentRecord {
  id: number;
  executorType: string;
  enabled: boolean;
  skills: string[];
}

export const SUPPORTED_EXECUTOR_TYPES: ExecutorType[] = ['CLAUDE_CODE', 'CODEX', 'OPENCODE'];

export function isSupportedExecutorType(value: unknown): value is ExecutorType {
  return typeof value === 'string' && SUPPORTED_EXECUTOR_TYPES.includes(value as ExecutorType);
}
