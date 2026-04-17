export interface CreateProjectInput {
  /** @maxLength 200 */
  name: string;
  /** @maxLength 5000 */
  description?: string;
  /** @maxLength 2000 */
  git_url?: string;
  /** @maxLength 2000 */
  local_path?: string;
}

export interface UpdateProjectInput {
  /** @maxLength 200 */
  name?: string;
  /** @maxLength 5000 */
  description?: string;
  /** @maxLength 2000 */
  git_url?: string | null;
  /** @maxLength 2000 */
  local_path?: string | null;
}
