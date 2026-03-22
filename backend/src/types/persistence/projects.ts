export interface ProjectCreateRecord {
  name: string;
  description?: string | undefined;
  git_url?: string | null | undefined;
  local_path?: string | null | undefined;
}

export interface ProjectUpdateRecord {
  name?: string | undefined;
  description?: string | undefined;
  git_url?: string | null | undefined;
  local_path?: string | null | undefined;
}
