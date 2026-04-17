export interface CreateIterationInput {
  project_id: number;
  /** @maxLength 200 */
  name?: string;
  /** @maxLength 5000 */
  description?: string;
  /** @maxLength 5000 */
  goal?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
}

export interface UpdateIterationInput {
  project_id?: number;
  /** @maxLength 200 */
  name?: string;
  /** @maxLength 5000 */
  description?: string;
  /** @maxLength 5000 */
  goal?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
}
