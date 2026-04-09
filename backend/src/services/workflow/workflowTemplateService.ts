import { WorkflowTemplateRepository } from '../../repositories/workflowTemplateRepository.js';
import { ValidationError, NotFoundError, ConflictError } from '../../utils/errors.js';
import type { WorkflowTemplateEntity, WorkflowTemplateStepEntity } from '../../types/entities.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeStep(step: unknown): WorkflowTemplateStepEntity {
  if (!isRecord(step)) {
    throw new ValidationError('无效的工作流模板步骤', 'Invalid workflow template steps');
  }

  const { id, name, instructionPrompt, agentId, requiresConfirmation } = step;

  if (typeof id !== 'string' || !id.trim()) {
    throw new ValidationError('步骤 ID 必须为非空字符串', 'step id must be a non-empty string');
  }

  if (typeof name !== 'string' || !name.trim()) {
    throw new ValidationError('步骤名称必须为非空字符串', 'step name must be a non-empty string');
  }

  if (typeof instructionPrompt !== 'string' || !instructionPrompt.trim()) {
    throw new ValidationError('instructionPrompt 必须为非空字符串', 'instructionPrompt must be a non-empty string');
  }

  if (typeof agentId !== 'number' || !Number.isInteger(agentId) || agentId < 0) {
    throw new ValidationError('agentId 必须为非负整数', 'agentId must be a non-negative integer');
  }

  // Handle requiresConfirmation - optional boolean
  const normalizedRequiresConfirmation = requiresConfirmation === true;

  return {
    id: id.trim(),
    name: name.trim(),
    instructionPrompt: instructionPrompt.trim(),
    agentId,
    requiresConfirmation: normalizedRequiresConfirmation,
  };
}

function normalizeTemplate(template: unknown): Omit<WorkflowTemplateEntity, 'id' | 'created_at' | 'updated_at'> {
  if (!isRecord(template)) {
    throw new ValidationError('无效的工作流模板', 'Invalid workflow template');
  }

  const { template_id, name, steps } = template;

  if (typeof template_id !== 'string' || !template_id.trim()) {
    throw new ValidationError('无效的工作流模板 ID', 'Invalid workflow template id');
  }

  if (typeof name !== 'string' || !name.trim()) {
    throw new ValidationError('工作流模板名称必须为非空字符串', 'Workflow template name must be a non-empty string');
  }

  if (!Array.isArray(steps) || steps.length < 1) {
    throw new ValidationError('工作流模板必须包含至少一个步骤', 'Workflow template must include at least one step');
  }

  const normalizedSteps = steps.map((step) => normalizeStep(step));
  if (new Set(normalizedSteps.map((step) => step.id)).size !== normalizedSteps.length) {
    throw new ValidationError('工作流模板步骤 ID 必须唯一', 'Workflow template step ids must be unique');
  }

  return {
    template_id: template_id.trim(),
    name: name.trim(),
    steps: normalizedSteps,
  };
}

class WorkflowTemplateService {
  workflowTemplateRepo: WorkflowTemplateRepository;

  constructor({ workflowTemplateRepo }: { workflowTemplateRepo?: WorkflowTemplateRepository } = {}) {
    this.workflowTemplateRepo = workflowTemplateRepo || new WorkflowTemplateRepository();
  }

  async getTemplates(): Promise<WorkflowTemplateEntity[]> {
    const templates = await this.workflowTemplateRepo.findAll();
    return templates
      .map((t, index) => ({ ...t, order: t.order ?? index }))
      .sort((a, b) => a.order - b.order);
  }

  async getTemplateById(templateId: string): Promise<WorkflowTemplateEntity | null> {
    return await this.workflowTemplateRepo.findByTemplateId(templateId);
  }

  async createTemplate(template: Omit<WorkflowTemplateEntity, 'id' | 'created_at' | 'updated_at'>): Promise<WorkflowTemplateEntity> {
    const normalizedTemplate = normalizeTemplate(template);

    const existing = await this.workflowTemplateRepo.findByTemplateId(normalizedTemplate.template_id);
    if (existing) {
      throw new ConflictError(`工作流模板已存在: ${normalizedTemplate.template_id}`, `Workflow template already exists: ${normalizedTemplate.template_id}`, { templateId: normalizedTemplate.template_id });
    }

    return await this.workflowTemplateRepo.create(normalizedTemplate);
  }

  async updateTemplate(templateId: string, template: Partial<Omit<WorkflowTemplateEntity, 'id' | 'template_id' | 'created_at' | 'updated_at'>>): Promise<WorkflowTemplateEntity | null> {
    const existing = await this.workflowTemplateRepo.findByTemplateId(templateId);
    if (!existing) {
      throw new NotFoundError(`未找到工作流模板: ${templateId}`, `Workflow template not found: ${templateId}`, { templateId });
    }

    const updateData: Partial<Omit<WorkflowTemplateEntity, 'id' | 'created_at' | 'updated_at'>> = {};
    if (template.name !== undefined) {
      updateData.name = template.name;
    }
    if (template.steps !== undefined) {
      updateData.steps = template.steps.map((step) => normalizeStep(step));
    }

    return await this.workflowTemplateRepo.update(existing.id, updateData);
  }

  async deleteTemplate(templateId: string): Promise<void> {
    const existing = await this.workflowTemplateRepo.findByTemplateId(templateId);
    if (!existing) {
      throw new NotFoundError(`未找到工作流模板: ${templateId}`, `Workflow template not found: ${templateId}`, { templateId });
    }

    await this.workflowTemplateRepo.delete(existing.id);
  }

  async reorderTemplates(updates: Array<{ id: number; order: number }>): Promise<WorkflowTemplateEntity[]> {
    const results: WorkflowTemplateEntity[] = [];
    for (const update of updates) {
      if (update.id != null && update.order !== undefined) {
        const updated = await this.workflowTemplateRepo.update(update.id, { order: update.order });
        if (updated) {
          results.push(updated);
        }
      }
    }
    return results;
  }
}

export { WorkflowTemplateService, normalizeTemplate };
