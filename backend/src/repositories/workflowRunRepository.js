/**
 * Workflow Run Repository
 * Manages workflow_runs.json using BaseRepository
 */
import { BaseRepository } from './base.js';

class WorkflowRunRepository extends BaseRepository {
  constructor() {
    super('workflow_runs.json');
  }

  /**
   * Find workflow run by task ID
   * @param {number} taskId
   * @returns {Promise<object|null>}
   */
  async findByTaskId(taskId) {
    const data = await this._loadAll();
    return data.find((item) => item.task_id === taskId) || null;
  }

  /**
   * Find all workflow runs for a task
   * @param {number} taskId
   * @returns {Promise<Array>}
   */
  async findAllByTaskId(taskId) {
    const data = await this._loadAll();
    return data.filter((item) => item.task_id === taskId);
  }

  /**
   * Update a specific step within a workflow run
   * @param {number} runId
   * @param {string} stepId
   * @param {object} stepUpdate
   * @returns {Promise<object|null>}
   */
  async updateStep(runId, stepId, stepUpdate) {
    const data = await this._loadAll();
    const index = data.findIndex((item) => item.id === runId);
    if (index === -1) return null;

    const run = data[index];
    const stepIndex = run.steps.findIndex((s) => s.step_id === stepId);
    if (stepIndex === -1) return null;

    run.steps[stepIndex] = { ...run.steps[stepIndex], ...stepUpdate };
    run.updated_at = new Date().toISOString();
    data[index] = run;

    await this._saveAll(data);
    return run;
  }
}

export { WorkflowRunRepository };
