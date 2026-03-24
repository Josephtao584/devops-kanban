import { WorkflowTemplateRepository } from '../../repositories/workflowTemplateRepository.js';

const BUILT_IN_TEMPLATES = [
  {
    template_id: 'dev-workflow-v1',
    name: '默认研发工作流',
    steps: [
      {
        id: 'requirement-design',
        name: '需求设计',
        instructionPrompt: '先完成需求分析，整理实现思路、关键约束和交付方案。',
        agentId: null,
      },
      {
        id: 'code-development',
        name: '代码开发',
        instructionPrompt: '根据上游步骤摘要完成代码实现，保持改动聚焦，并总结主要修改结果。',
        agentId: null,
      },
      {
        id: 'testing',
        name: '测试',
        instructionPrompt: '根据上游步骤摘要执行必要验证，说明测试结果、发现的问题和结论。',
        agentId: null,
      },
      {
        id: 'code-review',
        name: '代码审查',
        instructionPrompt: '根据上游步骤摘要完成代码审查，说明主要风险、问题和审查结论。',
        agentId: null,
      },
    ],
  },
] as const;

type WorkflowTemplateStep = {
  id: string;
  name: string;
  instructionPrompt: string;
  agentId: number | null;
};

type WorkflowTemplate = {
  template_id: string;
  name: string;
  steps: WorkflowTemplateStep[];
};

function createValidationError(message: string) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function cloneTemplate(template: WorkflowTemplate): WorkflowTemplate {
  return {
    template_id: template.template_id,
    name: template.name,
    steps: template.steps.map((step) => ({ ...step })),
  };
}

function buildBuiltInTemplates(): WorkflowTemplate[] {
  return BUILT_IN_TEMPLATES.map((template) => cloneTemplate(template));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeStep(step: unknown): WorkflowTemplateStep {
  if (!isRecord(step)) {
    throw createValidationError('Invalid workflow template steps');
  }

  const { id, name, instructionPrompt, agentId } = step;

  if (typeof id !== 'string' || !id.trim()) {
    throw createValidationError('step id must be a non-empty string');
  }

  if (typeof name !== 'string' || !name.trim()) {
    throw createValidationError('step name must be a non-empty string');
  }

  if (typeof instructionPrompt !== 'string' || !instructionPrompt.trim()) {
    throw createValidationError('instructionPrompt must be a non-empty string');
  }

  if (agentId !== null && (typeof agentId !== 'number' || !Number.isFinite(agentId))) {
    throw createValidationError('agentId must be a number or null');
  }

  return {
    id: id.trim(),
    name: name.trim(),
    instructionPrompt: instructionPrompt.trim(),
    agentId,
  };
}

function normalizeTemplate(template: unknown): WorkflowTemplate {
  if (!isRecord(template)) {
    throw createValidationError('Invalid workflow template');
  }

  const { template_id, name, steps } = template;

  if (typeof template_id !== 'string' || !template_id.trim()) {
    throw createValidationError('Invalid workflow template id');
  }

  if (typeof name !== 'string' || !name.trim()) {
    throw createValidationError('Workflow template name must be a non-empty string');
  }

  if (!Array.isArray(steps) || steps.length < 2) {
    throw createValidationError('Workflow template must include at least two steps');
  }

  const normalizedSteps = steps.map((step) => normalizeStep(step));
  if (new Set(normalizedSteps.map((step) => step.id)).size !== normalizedSteps.length) {
    throw createValidationError('Workflow template step ids must be unique');
  }

  return {
    template_id: template_id.trim(),
    name: name.trim(),
    steps: normalizedSteps,
  };
}

function mergeTemplates(storedTemplates: WorkflowTemplate[]): WorkflowTemplate[] {
  const merged = new Map<string, WorkflowTemplate>();

  for (const template of buildBuiltInTemplates()) {
    merged.set(template.template_id, template);
  }

  for (const template of storedTemplates) {
    merged.set(template.template_id, cloneTemplate(template));
  }

  return Array.from(merged.values());
}

class WorkflowTemplateService {
  workflowTemplateRepo: WorkflowTemplateRepository;

  constructor({ workflowTemplateRepo }: { workflowTemplateRepo?: WorkflowTemplateRepository } = {}) {
    this.workflowTemplateRepo = workflowTemplateRepo || new WorkflowTemplateRepository();
  }

  async getTemplates(): Promise<WorkflowTemplate[]> {
    const storedTemplates = (await this.workflowTemplateRepo.readAll()).map((template) => normalizeTemplate(template));

    if (storedTemplates.length > 0) {
      const mergedTemplates = mergeTemplates(storedTemplates);
      if (JSON.stringify(mergedTemplates) !== JSON.stringify(storedTemplates)) {
        await this.workflowTemplateRepo.saveAll(mergedTemplates);
      }
      return mergedTemplates;
    }

    const legacyTemplate = await this.workflowTemplateRepo.readLegacy();
    const mergedTemplates = mergeTemplates(legacyTemplate ? [normalizeTemplate(legacyTemplate)] : []);
    await this.workflowTemplateRepo.saveAll(mergedTemplates);
    return mergedTemplates;
  }

  async getTemplate(): Promise<WorkflowTemplate> {
    const templates = await this.getTemplates();
    const template = templates.find((entry) => entry.template_id === 'dev-workflow-v1');
    if (!template) {
      throw createValidationError('Workflow template not found: dev-workflow-v1');
    }
    return cloneTemplate(template);
  }

  async getTemplateById(templateId: string): Promise<WorkflowTemplate | null> {
    const templates = await this.getTemplates();
    const template = templates.find((entry) => entry.template_id === templateId);
    return template ? cloneTemplate(template) : null;
  }

  async updateTemplate(template: WorkflowTemplate): Promise<WorkflowTemplate> {
    const normalizedTemplate = normalizeTemplate(template);
    const templates = await this.getTemplates();
    const nextTemplates = templates.map((entry) => (
      entry.template_id === normalizedTemplate.template_id ? normalizedTemplate : entry
    ));

    if (!nextTemplates.some((entry) => entry.template_id === normalizedTemplate.template_id)) {
      nextTemplates.push(normalizedTemplate);
    }

    await this.workflowTemplateRepo.saveAll(nextTemplates);
    return cloneTemplate(normalizedTemplate);
  }

  _validateTemplate(template: WorkflowTemplate) {
    normalizeTemplate(template);
  }
}

export { WorkflowTemplateService, BUILT_IN_TEMPLATES, buildBuiltInTemplates, normalizeTemplate };
export type { WorkflowTemplate, WorkflowTemplateStep };
