import { BaseRepository } from './base.js';
import type { WorkflowTemplateEntity } from '../types/entities.js';

class WorkflowTemplateRepository extends BaseRepository<WorkflowTemplateEntity> {
  constructor() {
    super('workflow_templates');
  }

  protected override parseRow(row: Record<string, unknown>): WorkflowTemplateEntity {
    return {
      ...row,
      steps: row.steps ? JSON.parse(row.steps as string) : [],
      tags: row.tags ? JSON.parse(row.tags as string) : [],
    } as WorkflowTemplateEntity;
  }

  protected override serializeRow(entity: Partial<WorkflowTemplateEntity>): Record<string, unknown> {
    const result: Record<string, unknown> = { ...entity };
    if (entity.steps !== undefined) {
      result.steps = JSON.stringify(entity.steps);
    }
    if (entity.tags !== undefined) {
      result.tags = JSON.stringify(entity.tags);
    }
    return result;
  }

  async findByTemplateId(templateId: string): Promise<WorkflowTemplateEntity | null> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM workflow_templates WHERE template_id = ?',
      args: [templateId],
    });
    if (result.rows.length === 0) return null;
    return this.parseRow(result.rows[0] as Record<string, unknown>);
  }
}

export { WorkflowTemplateRepository };