export interface TaskCreateRecord {
  title: string;
  description?: string | undefined;
  project_id: number;
  iteration_id?: number | null | undefined;
  status?: string | undefined;
  priority?: string | undefined;
  assignee?: string | undefined;
  due_date?: string | undefined;
  order?: number | undefined;
  external_id?: string | null | undefined;
  external_url?: string | undefined;
  source?: string | undefined;
  labels?: string[] | undefined;
  workflow_run_id?: number | null | undefined;
  worktree_path?: string | null | undefined;
  worktree_branch?: string | null | undefined;
  worktree_status?: string | null | undefined;
}

export interface TaskUpdateRecord {
  title?: string | undefined;
  description?: string | undefined;
  project_id?: number | undefined;
  iteration_id?: number | null | undefined;
  status?: string | undefined;
  priority?: string | undefined;
  assignee?: string | undefined;
  due_date?: string | undefined;
  order?: number | undefined;
  external_id?: string | null | undefined;
  external_url?: string | undefined;
  source?: string | undefined;
  labels?: string[] | undefined;
  workflow_run_id?: number | null | undefined;
  worktree_path?: string | null | undefined;
  worktree_branch?: string | null | undefined;
  worktree_status?: string | null | undefined;
}
