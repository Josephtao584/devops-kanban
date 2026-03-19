/**
 * Execution Service
 */
import { ExecutionRepository } from '../repositories/executionRepository.js';
import { SessionRepository } from '../repositories/sessionRepository.js';
import { TaskRepository } from '../repositories/taskRepository.js';

class ExecutionService {
  constructor() {
    this.executionRepo = new ExecutionRepository();
    this.sessionRepo = new SessionRepository();
    this.taskRepo = new TaskRepository();
  }

  /**
   * Get all executions
   * @returns {Promise<Array>} All executions
   */
  async getAll() {
    return await this.executionRepo.findAll();
  }

  /**
   * Get execution by ID
   * @param {number} executionId - Execution ID
   * @returns {Promise<object|null>} Execution or null
   */
  async getById(executionId) {
    return await this.executionRepo.findById(executionId);
  }

  /**
   * Get all executions for a session
   * @param {number} sessionId - Session ID
   * @returns {Promise<Array>} Executions
   */
  async getBySession(sessionId) {
    return await this.executionRepo.getBySession(sessionId);
  }

  /**
   * Get all executions for a task
   * @param {number} taskId - Task ID
   * @returns {Promise<Array>} Executions
   */
  async getByTask(taskId) {
    return await this.executionRepo.getByTask(taskId);
  }

  /**
   * Create a new execution
   * @param {object} executionData - Execution data
   * @returns {Promise<object>} Created execution
   */
  async create(executionData) {
    // Verify session exists
    const session = await this.sessionRepo.findById(executionData.session_id);
    if (!session) {
      const error = new Error('Session not found');
      error.statusCode = 404;
      throw error;
    }

    // Get task_id from session
    const sessionData = await this.sessionRepo.findById(executionData.session_id);
    executionData.task_id = sessionData.task_id;

    return await this.executionRepo.create(executionData);
  }

  /**
   * Update an execution
   * @param {number} executionId - Execution ID
   * @param {object} executionData - Execution data to update
   * @returns {Promise<object|null>} Updated execution or null
   */
  async update(executionId, executionData) {
    return await this.executionRepo.update(executionId, executionData);
  }

  /**
   * Delete an execution
   * @param {number} executionId - Execution ID
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(executionId) {
    return await this.executionRepo.delete(executionId);
  }
}

export { ExecutionService };
