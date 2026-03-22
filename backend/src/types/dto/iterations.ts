export interface CreateIterationInput {
  project_id: number;
  name?: string;
  goal?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
}

export interface UpdateIterationInput {
  project_id?: number;
  name?: string;
  goal?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
}
