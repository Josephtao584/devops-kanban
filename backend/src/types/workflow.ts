export interface WorkflowTaskRecord {
  id: number;
  project_id: number;
  title?: string | undefined;
  description?: string | undefined;
  worktree_path?: string | null;
  worktree_branch?: string | null;
}