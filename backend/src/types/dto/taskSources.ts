import type { ImportedTask } from '../sources.ts';

export interface CreateTaskSourceInput {
  readonly __readOnlyCreateFields__?: never;
}

export interface UpdateTaskSourceInput {
  last_sync_at?: string;
}

export interface TaskSourceImportBody {
  items?: ImportedTask[];
  project_id?: number;
  iteration_id?: number | null;
}
