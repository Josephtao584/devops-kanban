export interface CreateProjectInput {
  name: string;
  description?: string;
  git_url?: string;
  local_path?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  git_url?: string | null;
  local_path?: string | null;
}
