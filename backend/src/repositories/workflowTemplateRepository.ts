import { BaseRepository } from './base.js';
import type { WorkflowTemplateEntity } from '../types/entities.js';

class WorkflowTemplateRepository extends BaseRepository<WorkflowTemplateEntity> {
  constructor() {
    super('workflow_templates.json');
  }

  async findByTemplateId(templateId: string): Promise<WorkflowTemplateEntity | null> {
    const templates = await this.findAll();
    return templates.find((template) => template.template_id === templateId) || null;
  }
}

export { WorkflowTemplateRepository };
