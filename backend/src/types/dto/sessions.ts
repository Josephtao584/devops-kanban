import type { ExecutorType } from '../executors.ts';

export interface CreateSessionInput {
  task_id: number;
  initial_prompt?: string | null;
}

export interface ContinueSessionBody {
  input: string;
}

export interface SessionListItem {
  id: number;
  task_id: number;
  status?: string;
  worktree_path?: string | null;
  branch?: string | null;
  initial_prompt?: string | null;
  agent_id?: number | null;
  executor_type?: ExecutorType | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}
