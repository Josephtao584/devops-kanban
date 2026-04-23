import { WorkflowTemplateRepository } from '../../repositories/workflowTemplateRepository.js';
import { AgentRepository } from '../../repositories/agentRepository.js';
import { ValidationError, NotFoundError, ConflictError } from '../../utils/errors.js';
import type { WorkflowTemplateEntity, WorkflowTemplateStepEntity } from '../../types/entities.js';
import type { ExportFile, ExportedWorkflowTemplate, ExportedWorkflowStep, ImportPreview, ImportConfirmInput } from '../../types/dto/workflowTemplates.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeStep(step: unknown): WorkflowTemplateStepEntity {
  if (!isRecord(step)) {
    throw new ValidationError('无效的工作流模板步骤', 'Invalid workflow template steps');
  }

  const { id, name, instructionPrompt, agentId, requiresConfirmation, canEarlyExit } = step;

  if (typeof id !== 'string' || !id.trim()) {
    throw new ValidationError('步骤 ID 必须为非空字符串', 'step id must be a non-empty string');
  }

  if (typeof name !== 'string' || !name.trim()) {
    throw new ValidationError('步骤名称必须为非空字符串', 'step name must be a non-empty string');
  }
  if (name.trim().length > 200) {
    throw new ValidationError('步骤名称不能超过 200 个字符', 'step name must not exceed 200 characters');
  }

  if (typeof instructionPrompt !== 'string' || !instructionPrompt.trim()) {
    throw new ValidationError('instructionPrompt 必须为非空字符串', 'instructionPrompt must be a non-empty string');
  }

  if (instructionPrompt.trim().length > 2000) {
    throw new ValidationError('instructionPrompt 不能超过 2000 个字符', 'instructionPrompt must not exceed 2000 characters');
  }

  if (typeof agentId !== 'number' || !Number.isInteger(agentId) || agentId < 0) {
    throw new ValidationError('agentId 必须为非负整数', 'agentId must be a non-negative integer');
  }

  // Handle requiresConfirmation - optional boolean
  const normalizedRequiresConfirmation = requiresConfirmation === true;
  const normalizedCanEarlyExit = canEarlyExit === true;

  return {
    id: id.trim(),
    name: name.trim(),
    instructionPrompt: instructionPrompt.trim(),
    agentId,
    requiresConfirmation: normalizedRequiresConfirmation,
    canEarlyExit: normalizedCanEarlyExit,
  };
}

function normalizeTemplate(template: unknown): Omit<WorkflowTemplateEntity, 'id' | 'created_at' | 'updated_at'> {
  if (!isRecord(template)) {
    throw new ValidationError('无效的工作流模板', 'Invalid workflow template');
  }

  const { template_id, name, steps, tags } = template;

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
    tags: Array.isArray(tags) ? tags : [],
  };
}

const BUILTIN_TEMPLATES: Omit<WorkflowTemplateEntity, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    template_id: 'repo-explorer',
    name: '探索代码仓',
    steps: [
      {
        id: 'explore',
        name: '代码仓探索',
        instructionPrompt: `你是一个代码分析专家。请深入分析当前代码仓库，生成一份结构化的介绍报告。

分析内容：
1. **项目概览**：目录结构、技术栈识别、主要语言统计、README 摘要
2. **核心模块**：识别核心模块及其职责、入口文件分析
3. **依赖关系**：主要依赖及其用途、模块间依赖关系
4. **架构模式**：识别架构模式（MVC、分层架构等）

最终输出格式化的 Markdown 报告，保存到 KANBAN_COMPASS.md 文件中。该文件将作为后续工作流执行的参考文档，其他工作流的 Agent 会读取此文件来了解项目结构。`,
        agentId: 1,
        requiresConfirmation: false,
      },
    ],
    order: 3,
  },
];

class WorkflowTemplateService {
  workflowTemplateRepo: WorkflowTemplateRepository;
  agentRepo: AgentRepository;

  constructor({ workflowTemplateRepo, agentRepo }: { workflowTemplateRepo?: WorkflowTemplateRepository; agentRepo?: AgentRepository } = {}) {
    this.workflowTemplateRepo = workflowTemplateRepo || new WorkflowTemplateRepository();
    this.agentRepo = agentRepo || new AgentRepository();
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

    if (template.name && template.name.length > 200) {
      throw new ValidationError('工作流模板名称不能超过 200 个字符', 'Workflow template name exceeds maximum length of 200 characters');
    }

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
    if (template.tags !== undefined) {
      updateData.tags = Array.isArray(template.tags) ? template.tags : [];
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

  // --- Export/Import ---

  async exportTemplate(templateId: string): Promise<ExportFile> {
    const template = await this.workflowTemplateRepo.findByTemplateId(templateId);
    if (!template) {
      throw new NotFoundError(`未找到工作流模板: ${templateId}`, `Workflow template not found: ${templateId}`, { templateId });
    }
    return this.buildExportFile([template]);
  }

  async exportTemplates(templateIds: string[]): Promise<ExportFile> {
    const allTemplates = await this.workflowTemplateRepo.findAll();
    const selected = allTemplates.filter(t => templateIds.includes(t.template_id));
    if (selected.length === 0) {
      throw new NotFoundError('未找到指定的工作流模板', 'No matching workflow templates found');
    }
    return this.buildExportFile(selected);
  }

  private async buildExportFile(templates: WorkflowTemplateEntity[]): Promise<ExportFile> {
    const agents = await this.agentRepo.findAll();
    const agentNameMap = new Map<number, string>();
    for (const agent of agents) {
      agentNameMap.set(agent.id, agent.name);
    }

    const exportedTemplates: ExportedWorkflowTemplate[] = templates.map(t => ({
      template_id: t.template_id,
      name: t.name,
      steps: t.steps.map((step): ExportedWorkflowStep => ({
        id: step.id,
        name: step.name,
        instructionPrompt: step.instructionPrompt,
        agentName: agentNameMap.get(step.agentId) || `Agent#${step.agentId}`,
        requiresConfirmation: step.requiresConfirmation || false,
      })),
    }));

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      templates: exportedTemplates,
    };
  }

  async previewImport(exportData: ExportFile): Promise<ImportPreview> {
    const existingTemplates = await this.workflowTemplateRepo.findAll();
    const existingIds = new Set(existingTemplates.map(t => t.template_id));

    const agents = await this.agentRepo.findAll();
    const agentNames = new Set(agents.map(a => a.name.toLowerCase()));

    const unmatchedAgentNames = new Set<string>();
    for (const tpl of exportData.templates) {
      for (const step of tpl.steps) {
        if (!agentNames.has(step.agentName.toLowerCase())) {
          unmatchedAgentNames.add(step.agentName);
        }
      }
    }

    return {
      templates: exportData.templates,
      existingTemplateIds: exportData.templates
        .filter(t => existingIds.has(t.template_id))
        .map(t => t.template_id),
      unmatchedAgentNames: [...unmatchedAgentNames],
    };
  }

  async confirmImport(input: ImportConfirmInput): Promise<{ imported: WorkflowTemplateEntity[]; skipped: string[] }> {
    const validStrategies = new Set(['skip', 'overwrite', 'copy']);
    if (!validStrategies.has(input.strategy)) {
      throw new ValidationError('无效的导入策略', `Invalid import strategy: ${input.strategy}`);
    }

    const agents = await this.agentRepo.findAll();
    const agentNameMap = new Map<string, number>();
    for (const agent of agents) {
      agentNameMap.set(agent.name.toLowerCase(), agent.id);
    }

    const imported: WorkflowTemplateEntity[] = [];
    const skipped: string[] = [];

    for (const tpl of input.templates) {
      const existing = await this.workflowTemplateRepo.findByTemplateId(tpl.template_id);

      if (existing && input.strategy === 'skip') {
        skipped.push(tpl.template_id);
        continue;
      }

      // Resolve agent names to IDs, then validate steps via normalizeStep
      const steps: WorkflowTemplateStepEntity[] = tpl.steps.map(step => {
        let agentId = agentNameMap.get(step.agentName.toLowerCase());
        if (agentId === undefined && input.agentMappings[step.agentName] !== undefined) {
          agentId = input.agentMappings[step.agentName];
        }
        if (agentId === undefined) {
          agentId = 0;
        }
        return normalizeStep({
          id: step.id,
          name: step.name,
          instructionPrompt: step.instructionPrompt,
          agentId,
          requiresConfirmation: step.requiresConfirmation || false,
        });
      });

      // Validate template structure
      normalizeTemplate({ template_id: tpl.template_id, name: tpl.name, steps });

      let finalTemplateId = tpl.template_id;
      if (existing && input.strategy === 'copy') {
        let suffix = 1;
        let candidate = `${tpl.template_id}-copy`;
        while (await this.workflowTemplateRepo.findByTemplateId(candidate)) {
          suffix += 1;
          candidate = `${tpl.template_id}-copy-${suffix}`;
        }
        finalTemplateId = candidate;
      }

      if (existing && input.strategy === 'overwrite') {
        const updated = await this.workflowTemplateRepo.update(existing.id, {
          name: tpl.name,
          steps,
        });
        if (updated) imported.push(updated);
      } else if (!existing || input.strategy === 'copy') {
        const created = await this.workflowTemplateRepo.create({
          template_id: finalTemplateId,
          name: input.strategy === 'copy' && existing ? `${tpl.name} (副本)` : tpl.name,
          steps,
        });
        imported.push(created);
      }
    }

    return { imported, skipped };
  }
}

export { WorkflowTemplateService, normalizeTemplate };

export async function bootstrapBuiltinTemplates(repo?: WorkflowTemplateRepository): Promise<void> {
  const service = new WorkflowTemplateService(repo ? { workflowTemplateRepo: repo } : {});
  for (const tpl of BUILTIN_TEMPLATES) {
    const existing = await service.getTemplateById(tpl.template_id);
    if (!existing) {
      await service.createTemplate(tpl);
      console.log(`[Templates] Built-in template "${tpl.name}" created.`);
    }
  }
}
