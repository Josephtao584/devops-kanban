export interface ProjectEntity {
  id: number;
  name: string;
  description?: string;
  git_url?: string | null;
  local_path?: string | null;
  [key: string]: unknown;
}

export interface TaskEntity {
  id: number;
  title: string;
  description?: string;
  project_id: number;
  status?: string;
  priority?: string;
  external_id?: string | null;
  workflow_run_id?: number | null;
  worktree_path?: string | null;
  worktree_branch?: string | null;
  [key: string]: unknown;
}

export interface SessionEntity {
  id: number;
  task_id: number;
  status?: string;
  output?: string | null;
  worktree_path?: string | null;
  branch?: string | null;
  initial_prompt?: string | null;
  [key: string]: unknown;
}

export interface WorkflowStepEntity {
  step_id: string;
  name: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  retry_count: number;
  output: unknown;
  error: string | null;
}

export interface WorkflowRunEntity {
  id: number;
  task_id: number;
  workflow_id: string;
  workflow_template_id?: string | null;
  workflow_template_snapshot?: WorkflowTemplateEntity | null;
  status: string;
  current_step: string | null;
  steps: WorkflowStepEntity[];
  worktree_path: string;
  branch: string;
  context: Record<string, unknown>;
  [key: string]: unknown;
}

export interface WorkflowTemplateEntity {
  template_id: string;
  name: string;
  steps: Array<{
    id: string;
    name: string;
    instructionPrompt: string;
    agentId: number | null;
  }>;
}

export interface TaskSourceEntity {
  id: number;
  name: string;
  type: string;
  project_id: number;
  config: Record<string, unknown>;
  enabled: boolean;
  last_sync_at?: string | null;
  [key: string]: unknown;
}
