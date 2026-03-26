export interface IterationCreateRecord {
  project_id: number;
  name?: string | undefined;
  description?: string | undefined;
  goal?: string | undefined;
  start_date?: string | undefined;
  end_date?: string | undefined;
  status?: string | undefined;
}

export interface IterationUpdateRecord {
  project_id?: number | undefined;
  name?: string | undefined;
  description?: string | undefined;
  goal?: string | undefined;
  start_date?: string | undefined;
  end_date?: string | undefined;
  status?: string | undefined;
}
