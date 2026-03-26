import type { ImportedTask } from '../sources.ts';

export interface CreateTaskSourceInput {
  name: string;
  type: string;
  project_id: number;
  config: Record<string, unknown>;
  enabled: boolean;
  readonly __readOnlyCreateFields__?: never;
}

export interface UpdateTaskSourceInput {
  name?: string;
  type?: string;
  project_id?: number;
  config?: Record<string, unknown>;
  enabled?: boolean;
  last_sync_at?: string;
}

export interface TaskSourceImportBody {
  items?: ImportedTask[];
  project_id?: number;
  iteration_id?: number | null;
}

export interface TaskSourcePreviewBody {
  limit?: number;
  offset?: number;
}
