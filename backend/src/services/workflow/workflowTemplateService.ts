import { WorkflowTemplateRepository } from '../../repositories/workflowTemplateRepository.js';

const FIXED_STEPS = [
  {
    id: 'requirement-design',
    name: '需求设计',
    instructionPrompt: '先完成需求分析，整理实现思路、关键约束和交付方案。',
  },
  {
    id: 'code-development',
    name: '代码开发',
    instructionPrompt: '根据上游步骤摘要完成代码实现，保持改动聚焦，并总结主要修改结果。',
  },
  {
    id: 'testing',
    name: '测试',
    instructionPrompt: '根据上游步骤摘要执行必要验证，说明测试结果、发现的问题和结论。',
  },
  {
    id: 'code-review',
    name: '代码审查',
    instructionPrompt: '根据上游步骤摘要完成代码审查，说明主要风险、问题和审查结论。',
  },
] as const;

const FIXED_STEP_BY_ID = new Map(FIXED_STEPS.map((step) => [step.id, step] as const));

type FixedStepId = typeof FIXED_STEPS[number]['id'];

type WorkflowTemplateStep = {
  id: string;
  name: string;
  instructionPrompt: string;
  agentId: number | null;
};

function isFixedStepId(value: string): value is FixedStepId {
  return FIXED_STEP_BY_ID.has(value as FixedStepId);
}

type WorkflowTemplate = {
  template_id: string;
  name: string;
  steps: WorkflowTemplateStep[];
};

function buildDefaultTemplate(): WorkflowTemplate {
  return {
    template_id: 'dev-workflow-v1',
    name: '默认研发工作流',
    steps: FIXED_STEPS.map((step) => ({
      id: step.id,
      name: step.name,
      instructionPrompt: step.instructionPrompt,
      agentId: null,
    })),
  };
}

function createValidationError(message: string) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function isWorkflowTemplateStepRecord(value: unknown): value is Partial<WorkflowTemplateStep> & { id?: unknown; name?: unknown } {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeStep(
  step: Partial<WorkflowTemplateStep> | undefined,
  fixedStep: typeof FIXED_STEPS[number],
): WorkflowTemplateStep {
  return {
    id: fixedStep.id,
    name: fixedStep.name,
    instructionPrompt: typeof step?.instructionPrompt === 'string' && step.instructionPrompt.trim()
      ? step.instructionPrompt
      : fixedStep.instructionPrompt,
    agentId: typeof step?.agentId === 'number' && Number.isFinite(step.agentId)
      ? step.agentId
      : null,
  };
}

function normalizeTemplate(template: WorkflowTemplate | null): WorkflowTemplate | null {
  if (!template) {
    return null;
  }

  if (template.template_id !== 'dev-workflow-v1') {
    throw createValidationError('Invalid workflow template id');
  }

  if (!Array.isArray(template.steps)) {
    throw createValidationError('Invalid workflow template steps');
  }

  if (!template.steps.every((step) => isWorkflowTemplateStepRecord(step))) {
    throw createValidationError('Invalid workflow template steps');
  }

  const actualStepIds = template.steps.map((step) => step.id);
  const expectedStepIds = FIXED_STEPS.map((step) => step.id);
  if (
    actualStepIds.length !== expectedStepIds.length
    || new Set(actualStepIds).size !== expectedStepIds.length
    || expectedStepIds.some((stepId) => !actualStepIds.includes(stepId))
  ) {
    throw createValidationError('Invalid workflow template step ids');
  }

  for (const step of template.steps) {
    if (!isFixedStepId(step.id)) {
      throw createValidationError('Invalid workflow template step names');
    }

    const fixedStep = FIXED_STEP_BY_ID.get(step.id);
    if (!fixedStep || step.name !== fixedStep.name) {
      throw createValidationError('Invalid workflow template step names');
    }
  }

  const stepsById = new Map<FixedStepId, WorkflowTemplateStep>(
    template.steps.map((step) => {
      if (!isFixedStepId(step.id)) {
        throw createValidationError('Invalid workflow template step ids');
      }
      return [step.id, step] as const;
    }),
  );

  return {
    ...template,
    steps: FIXED_STEPS.map((fixedStep) => normalizeStep(stepsById.get(fixedStep.id), fixedStep)),
  };
}

class WorkflowTemplateService {
  workflowTemplateRepo: WorkflowTemplateRepository;

  constructor({ workflowTemplateRepo }: { workflowTemplateRepo?: WorkflowTemplateRepository } = {}) {
    this.workflowTemplateRepo = workflowTemplateRepo || new WorkflowTemplateRepository();
  }

  async getTemplate(): Promise<WorkflowTemplate> {
    const existing = await this.workflowTemplateRepo.get();
    if (existing) {
      const normalized = normalizeTemplate(existing as WorkflowTemplate);
      if (JSON.stringify(normalized) !== JSON.stringify(existing)) {
        await this.workflowTemplateRepo.save(normalized as WorkflowTemplate);
      }
      return normalized as WorkflowTemplate;
    }

    const template = buildDefaultTemplate();
    await this.workflowTemplateRepo.save(template);
    return template;
  }

  async updateTemplate(template: WorkflowTemplate): Promise<WorkflowTemplate> {
    this._validateTemplate(template);
    await this.workflowTemplateRepo.save(template);
    return template;
  }

  _validateTemplate(template: WorkflowTemplate) {
    if (!template || template.template_id !== 'dev-workflow-v1') {
      throw createValidationError('Invalid workflow template id');
    }

    const actualStepIds = Array.isArray(template.steps) && template.steps.every((step) => isWorkflowTemplateStepRecord(step))
      ? template.steps.map((step) => step.id)
      : [];
    const expectedStepIds = FIXED_STEPS.map((step) => step.id);
    if (JSON.stringify(actualStepIds) !== JSON.stringify(expectedStepIds)) {
      throw createValidationError('Invalid workflow template step ids');
    }

    for (const step of template.steps) {
      if (!isFixedStepId(step.id)) {
        throw createValidationError('Invalid workflow template step names');
      }

      const fixedStep = FIXED_STEP_BY_ID.get(step.id);
      if (!fixedStep || step.name !== fixedStep.name) {
        throw createValidationError('Invalid workflow template step names');
      }

      if (typeof step.instructionPrompt !== 'string' || !step.instructionPrompt.trim()) {
        throw createValidationError('instructionPrompt must be a non-empty string');
      }

      if (step.agentId !== null && (typeof step.agentId !== 'number' || !Number.isFinite(step.agentId))) {
        throw createValidationError('agentId must be a number or null');
      }
    }
  }
}

export { WorkflowTemplateService, FIXED_STEPS, buildDefaultTemplate, normalizeTemplate };
export type { WorkflowTemplate, WorkflowTemplateStep };
