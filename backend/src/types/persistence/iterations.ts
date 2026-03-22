export interface IterationCreateRecord extends Record<string, unknown> {
  project_id: number;
  name?: string | undefined;
  status?: string | undefined;
}

export interface IterationUpdateRecord extends Record<string, unknown> {
  project_id?: number | undefined;
  name?: string | undefined;
  status?: string | undefined;
}
