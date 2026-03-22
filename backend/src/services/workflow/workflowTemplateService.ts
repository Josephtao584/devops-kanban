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

const SUPPORTED_EXECUTOR_TYPES = new Set(['CLAUDE_CODE', 'CODEX', 'OPENCODE']);

type WorkflowTemplateStep = {
  id: string;
  name: string;
  instructionPrompt: string;
  executor: {
    type: string;
    commandOverride: string | null;
    args: string[];
    env: Record<string, string>;
  };
};

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
      ...step,
      executor: {
        type: 'CLAUDE_CODE',
        commandOverride: null,
        args: [],
        env: {},
      },
    })),
  };
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.entries(value as Record<string, unknown>).every(([key, item]) => typeof key === 'string' && typeof item === 'string');
}

function normalizeStep(step: Partial<WorkflowTemplateStep> | undefined, fixedStep: typeof FIXED_STEPS[number]): WorkflowTemplateStep {
  return {
    ...fixedStep,
    ...step,
    instructionPrompt: typeof step?.instructionPrompt === 'string' && step.instructionPrompt.trim()
      ? step.instructionPrompt
      : fixedStep.instructionPrompt,
    executor: {
      type: 'CLAUDE_CODE',
      commandOverride: null,
      args: [],
      env: {},
      ...(step?.executor || {}),
    },
  };
}

function normalizeTemplate(template: WorkflowTemplate | null): WorkflowTemplate | null {
  if (!template || template.template_id !== 'dev-workflow-v1') {
    return template;
  }

  if (!Array.isArray(template.steps)) {
    return template;
  }

  return {
    ...template,
    steps: FIXED_STEPS.map((fixedStep, index) => normalizeStep(template.steps[index], fixedStep)),
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
      throw new Error('Invalid workflow template id');
    }

    const actualStepIds = Array.isArray(template.steps) ? template.steps.map((step) => step.id) : [];
    const expectedStepIds = FIXED_STEPS.map((step) => step.id);
    if (JSON.stringify(actualStepIds) !== JSON.stringify(expectedStepIds)) {
      throw new Error('Invalid workflow template step ids');
    }

    for (const step of template.steps) {
      if (typeof step.instructionPrompt !== 'string' || !step.instructionPrompt.trim()) {
        throw new Error('instructionPrompt must be a non-empty string');
      }

      if (!step.executor || !SUPPORTED_EXECUTOR_TYPES.has(step.executor.type)) {
        throw new Error('Unsupported executor type');
      }

      if (step.executor.commandOverride !== null && step.executor.commandOverride !== undefined) {
        if (typeof step.executor.commandOverride !== 'string' || !step.executor.commandOverride.trim()) {
          throw new Error('commandOverride must be a non-empty string');
        }
      }

      if (!Array.isArray(step.executor.args) || step.executor.args.some((arg) => typeof arg !== 'string')) {
        throw new Error('args must be an array of strings');
      }

      if (!isStringRecord(step.executor.env || {})) {
        throw new Error('env must be an object of string values');
      }
    }
  }
}

export { WorkflowTemplateService, FIXED_STEPS, SUPPORTED_EXECUTOR_TYPES, buildDefaultTemplate, normalizeTemplate };
export type { WorkflowTemplate, WorkflowTemplateStep };
