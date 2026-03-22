export interface ProjectCreateRecord extends Record<string, unknown> {
  name: string;
  description?: string | undefined;
  git_url?: string | null | undefined;
  local_path?: string | null | undefined;
}

export interface ProjectUpdateRecord extends Record<string, unknown> {
  name?: string | undefined;
  description?: string | undefined;
  git_url?: string | null | undefined;
  local_path?: string | null | undefined;
}
