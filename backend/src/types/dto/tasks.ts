export interface CreateTaskInput {
  title?: string;
  description?: string;
  project_id: number;
  iteration_id?: number | null;
  status?: string;
  priority?: string;
  assignee?: string;
  due_date?: string;
  external_id?: string | null;
  workflow_run_id?: number | null;
  worktree_path?: string | null;
  worktree_branch?: string | null;
  worktree_status?: string | null;
  order?: number;
}

import type { WorkflowTemplateEntity } from '../entities.ts';

export interface StartTaskInput {
  workflow_template_id: string;
  workflow_template_snapshot?: WorkflowTemplateEntity;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  project_id?: number;
  iteration_id?: number | null;
  status?: string;
  priority?: string;
  assignee?: string;
  due_date?: string;
  external_id?: string | null;
  workflow_run_id?: number | null;
  worktree_path?: string | null;
  worktree_branch?: string | null;
  worktree_status?: string | null;
  order?: number;
}
