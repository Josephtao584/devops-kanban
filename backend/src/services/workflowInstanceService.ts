import { WorkflowInstanceRepository } from '../repositories/workflowInstanceRepository.js';
import { WorkflowTemplateService } from './workflow/workflowTemplateService.js';
import { NotFoundError } from '../utils/errors.js';
import type { WorkflowInstanceEntity, WorkflowTemplateEntity } from '../types/entities.js';

class WorkflowInstanceService {
  instanceRepo: WorkflowInstanceRepository;
  templateService: WorkflowTemplateService;

  constructor({ instanceRepo, templateService }: {
    instanceRepo?: WorkflowInstanceRepository;
    templateService?: WorkflowTemplateService;
  } = {}) {
    this.instanceRepo = instanceRepo || new WorkflowInstanceRepository();
    this.templateService = templateService || new WorkflowTemplateService();
  }

  /**
   * 从 Template 创建不可变的 WorkflowInstance
   */
  async createFromTemplate(templateId: string): Promise<WorkflowInstanceEntity> {
    const template = await this.templateService.getTemplateById(templateId);
    if (!template) {
      throw new NotFoundError('未找到工作流模板', 'Workflow template not found', { templateId });
    }

    return this.createFromTemplateSnapshot(template);
  }

  /**
   * 从 Template Snapshot 创建不可变的 WorkflowInstance
   */
  async createFromTemplateSnapshot(template: WorkflowTemplateEntity): Promise<WorkflowInstanceEntity> {
    // 生成 UUID 作为 instance_id
    const instanceId = crypto.randomUUID();

    return this.instanceRepo.create({
      instance_id: instanceId,
      template_id: template.template_id,
      template_version: new Date().toISOString(),
      name: template.name,
      steps: template.steps,
    });
  }

  /**
   * 根据 instance_id 获取 Instance
   */
  async getByInstanceId(instanceId: string): Promise<WorkflowInstanceEntity | null> {
    return this.instanceRepo.findByInstanceId(instanceId);
  }
}

export { WorkflowInstanceService };