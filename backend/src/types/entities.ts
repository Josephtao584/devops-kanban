import type { ExecutorType } from './executors.ts';

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
  workflow_run_id?: number | null;
  workflow_step_id?: string | null;
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

export interface SessionSegmentEntity {
  id: number;
  session_id: number;
  segment_index: number;
  status: string;
  executor_type: ExecutorType;
  agent_id: number | null;
  provider_session_id?: string | null;
  resume_token?: string | null;
  checkpoint_ref?: string | null;
  trigger_type: 'START' | 'CONTINUE' | 'RESUME' | 'RETRY';
  parent_segment_id?: number | null;
  started_at?: string | null;
  completed_at?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface SessionEventEntity {
  id: number;
  session_id: number;
  segment_id: number;
  seq: number;
  kind: 'message' | 'tool_call' | 'tool_result' | 'status' | 'error' | 'artifact' | 'stream_chunk';
  role: 'assistant' | 'system' | 'tool' | 'user';
  content: string;
  payload: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface WorkflowStepEntity {
  step_id: string;
  name: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  retry_count: number;
  error: string | null;
  session_id: number | null;
  summary: string | null;
}

export interface WorkflowRunEntity {
  id: number;
  task_id: number;
  workflow_id: string;
  workflow_template_id: string;
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
    agentId: number;
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
