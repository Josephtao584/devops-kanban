export interface IterationCreateRecord {
  project_id: number;
  name?: string | undefined;
  status?: string | undefined;
}

export interface IterationUpdateRecord {
  project_id?: number | undefined;
  name?: string | undefined;
  status?: string | undefined;
}
