export interface CreateExecutionInput {
  session_id: number;
  status?: string;
  command?: string;
  output?: string;
  branch?: string;
  worktree_path?: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  agent_id?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateExecutionInput {
  task_id?: number;
  status?: string;
  command?: string;
  output?: string;
  branch?: string;
  worktree_path?: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  agent_id?: number;
  metadata?: Record<string, unknown>;
}
