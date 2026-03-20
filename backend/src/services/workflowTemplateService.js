import { WorkflowTemplateRepository } from '../repositories/workflowTemplateRepository.js';

const FIXED_STEPS = [
  { id: 'requirement-design', name: '需求设计' },
  { id: 'code-development', name: '代码开发' },
  { id: 'testing', name: '测试' },
  { id: 'code-review', name: '代码审查' },
];

const SUPPORTED_EXECUTOR_TYPES = new Set(['CLAUDE_CODE', 'CODEX', 'OPENCODE']);

function buildDefaultTemplate() {
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

function isStringRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.entries(value).every(([key, item]) => typeof key === 'string' && typeof item === 'string');
}

class WorkflowTemplateService {
  constructor({ workflowTemplateRepo } = {}) {
    this.workflowTemplateRepo = workflowTemplateRepo || new WorkflowTemplateRepository();
  }

  async getTemplate() {
    const existing = await this.workflowTemplateRepo.get();
    if (existing) {
      return existing;
    }

    const template = buildDefaultTemplate();
    await this.workflowTemplateRepo.save(template);
    return template;
  }

  async updateTemplate(template) {
    this._validateTemplate(template);
    await this.workflowTemplateRepo.save(template);
    return template;
  }

  _validateTemplate(template) {
    if (!template || template.template_id !== 'dev-workflow-v1') {
      throw new Error('Invalid workflow template id');
    }

    const actualStepIds = Array.isArray(template.steps) ? template.steps.map((step) => step.id) : [];
    const expectedStepIds = FIXED_STEPS.map((step) => step.id);
    if (JSON.stringify(actualStepIds) !== JSON.stringify(expectedStepIds)) {
      throw new Error('Invalid workflow template step ids');
    }

    for (const step of template.steps) {
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

export { WorkflowTemplateService, FIXED_STEPS, SUPPORTED_EXECUTOR_TYPES, buildDefaultTemplate };
