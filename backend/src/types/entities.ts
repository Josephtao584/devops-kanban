import type { ExecutorType } from './executors.ts';

export interface ProjectEntity {
  id: number;
  name: string;
  description: string | undefined;
  git_url: string | undefined;
  local_path: string | undefined;
  env: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface TaskEntity {
  id: number;
  title: string;
  description: string | undefined;
  project_id: number;
  status: string;
  priority: string;
  assignee?: string;
  due_date?: string;
  order?: number;
  external_id?: string | null;
  external_url?: string | undefined;
  workflow_run_id?: number | null;
  worktree_path?: string | null;
  worktree_branch?: string | null;
  worktree_status?: string | null;
  iteration_id?: number | null;
  source: string;
  labels?: string[];
  auto_execute?: number;
  auto_execute_template_id?: string | null;
  created_at: string;
  updated_at: string;
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
  metadata?: Record<string, unknown>;
  agent_id?: number | null;
  executor_type: ExecutorType;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
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
  created_at: string;
  updated_at: string;
}

export interface SessionEventEntity {
  id: number;
  session_id: number;
  segment_id: number;
  seq: number;
  kind: 'message' | 'tool_call' | 'tool_result' | 'status' | 'error' | 'artifact' | 'stream_chunk' | 'ask_user';
  role: 'assistant' | 'system' | 'tool' | 'user';
  content: string;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
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
  agent_id?: number | null;
  provider_session_id?: string | null;
  summary: string | null;
  assembled_prompt?: string | null;
  // Suspend/resume fields
  suspend_reason?: string | null;
  confirmation_note?: string | null;
  confirmed_at?: string | null;
  // AskUserQuestion fields
  ask_user_question?: Record<string, unknown> | null;
  ask_user_answer?: string | null;
  // Early exit fields
  early_exit?: boolean | null;
  early_exit_reason?: string | null;
}

export interface WorkflowTemplateStepEntity {
  id: string;
  name: string;
  instructionPrompt: string;
  agentId: number;
  // Suspend/resume configuration
  requiresConfirmation?: boolean;
  // Early exit configuration
  canEarlyExit?: boolean;
}

export interface WorkflowRunEntity {
  id: number;
  task_id: number;
  workflow_instance_id: string;
  mastra_run_id: string | null;
  status: string;
  current_step: string | null;
  steps: WorkflowStepEntity[];
  worktree_path: string;
  branch: string;
  context: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WorkflowInstanceEntity {
  id: number;
  instance_id: string;
  template_id: string;
  template_version: string;
  name: string;
  steps: WorkflowTemplateStepEntity[];
  created_at: string;
  updated_at: string;
}

export interface WorkflowTemplateEntity {
  id: number;
  template_id: string;
  name: string;
  steps: WorkflowTemplateStepEntity[];
  tags?: string[];
  order?: number;
  created_at: string;
  updated_at: string;
}

export interface TaskSourceEntity {
  id: number;
  name: string;
  type: string;
  project_id: number;
  config: Record<string, unknown>;
  enabled: boolean;
  last_sync_at?: string | null;
  sync_schedule?: string | null;
  default_workflow_template_id?: string | null;
  last_scheduled_sync_at?: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface AgentEntity {
  id: number;
  name: string;
  executorType: ExecutorType;
  role: string;
  description?: string;
  enabled: boolean;
  skills: number[];
  mcpServers: number[];
  env: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface IterationEntity {
  id: number;
  project_id: number;
  name: string;
  description: string | undefined;
  goal: string | undefined;
  status: string;
  start_date: string | undefined;
  end_date: string | undefined;
  created_at: string;
  updated_at: string;
}

export interface ExecutionEntity {
  id: number;
  session_id?: number;
  task_id?: number;
  created_at: string;
  updated_at: string;
}

export interface SkillEntity {
  id: number;
  identifier: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface McpServerEntity {
  id: number;
  name: string;
  description: string | undefined;
  server_type: 'stdio' | 'http';
  config: Record<string, unknown>;
  auto_install: number;
  install_command: string | undefined;
  created_at: string;
  updated_at: string;
}

export interface SettingEntity {
  key: string;
  value: string;
  updated_at: string;
}
