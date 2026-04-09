import { ExecutionRepository } from '../repositories/executionRepository.js';
import { SessionRepository } from '../repositories/sessionRepository.js';
import { NotFoundError } from '../utils/errors.js';
import type { ExecutionEntity } from '../types/entities.js';
import type {
  CreateExecutionInput as CreateExecutionDto,
  UpdateExecutionInput as UpdateExecutionDto,
} from '../types/dto/executions.js';

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

  async create(executionData: CreateExecutionInput) {
    const session = await this.sessionRepo.findById(executionData.session_id);
    if (!session) {
      throw new NotFoundError('未找到会话', 'Session not found', { sessionId: executionData.session_id });
    }

    const createData: Omit<ExecutionEntity, 'id' | 'created_at' | 'updated_at'> = {
      ...executionData,
      task_id: session.task_id,
    };

    return await this.executionRepo.create(createData);
  }

  async update(executionId: number, executionData: UpdateExecutionInput) {
    const updateData: Partial<ExecutionEntity> = { ...executionData };
    return await this.executionRepo.update(executionId, updateData);
  }

  async delete(executionId: number) {
    return await this.executionRepo.delete(executionId);
  }
}

export { ExecutionService };
export type CreateExecutionInput = CreateExecutionDto;
export type UpdateExecutionInput = UpdateExecutionDto;
