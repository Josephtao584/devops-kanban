import { ExecutionRepository } from '../repositories/executionRepository.js';
import { SessionRepository } from '../repositories/sessionRepository.js';

class ExecutionService {
  executionRepo: ExecutionRepository;
  sessionRepo: SessionRepository;

  constructor() {
    this.executionRepo = new ExecutionRepository();
    this.sessionRepo = new SessionRepository();
  }

  async getAll() {
    return await this.executionRepo.findAll();
  }

  async getById(executionId: number) {
    return await this.executionRepo.findById(executionId);
  }

  async getBySession(sessionId: number) {
    return await this.executionRepo.getBySession(sessionId);
  }

  async getByTask(taskId: number) {
    return await this.executionRepo.getByTask(taskId);
  }

  async create(executionData: Record<string, unknown> & { session_id: number; task_id?: number }) {
    const session = await this.sessionRepo.findById(executionData.session_id);
    if (!session) {
      const error = new Error('Session not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    executionData.task_id = session.task_id;
    return await this.executionRepo.create(executionData);
  }

  async update(executionId: number, executionData: Record<string, unknown>) {
    return await this.executionRepo.update(executionId, executionData);
  }

  async delete(executionId: number) {
    return await this.executionRepo.delete(executionId);
  }
}

export { ExecutionService };
