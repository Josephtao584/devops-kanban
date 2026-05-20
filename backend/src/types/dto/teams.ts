export interface CreateTeamInput {
  /** @maxLength 200 */
  name: string;
  /** @maxLength 5000 */
  description?: string;
}

export interface UpdateTeamInput {
  /** @maxLength 200 */
  name?: string;
  /** @maxLength 5000 */
  description?: string;
}

export interface AddProjectToTeamInput {
  project_id: number;
  repo_role: 'knowledge' | 'development';
}
