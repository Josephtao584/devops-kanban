import { BaseRepository } from './base.js';
import type { WorkflowInstanceEntity } from '../types/entities.js';
import type { InValue } from '@libsql/client';

class WorkflowInstanceRepository extends BaseRepository<WorkflowInstanceEntity> {
  constructor() {
    super('workflow_instances');
  }

  protected override parseRow(row: Record<string, unknown>): WorkflowInstanceEntity {
    return {
      ...row,
      steps: row.steps ? JSON.parse(row.steps as string) : [],
    } as WorkflowInstanceEntity;
  }

  protected override serializeRow(entity: Partial<WorkflowInstanceEntity>): Record<string, unknown> {
    const result: Record<string, unknown> = { ...entity };
    if (entity.steps !== undefined) {
      result.steps = JSON.stringify(entity.steps);
    }
    return result;
  }

  async findByInstanceId(instanceId: string): Promise<WorkflowInstanceEntity | null> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM workflow_instances WHERE instance_id = ?',
      args: [instanceId],
    });
    if (result.rows.length === 0) return null;
    return this.parseRow(result.rows[0] as Record<string, unknown>);
  }

  override async create(entityData: Omit<WorkflowInstanceEntity, 'id' | 'created_at' | 'updated_at'>): Promise<WorkflowInstanceEntity> {
    const now = new Date().toISOString();
    const data = this.serializeRow(entityData as Partial<WorkflowInstanceEntity>);

    const columns = Object.keys(data).map(key => `"${key}"`);
    const values = Object.values(data);
    const placeholders = columns.map(() => '?').join(', ');

    const sql = `INSERT INTO workflow_instances (${columns.join(', ')}, "created_at", "updated_at") VALUES (${placeholders}, ?, ?)`;
    const result = await this.client.execute({
      sql,
      args: [...values as InValue[], now, now],
    });

    const created = await this.findById(Number(result.lastInsertRowid));
    if (!created) {
      throw new Error(`Failed to fetch created workflow instance with id ${result.lastInsertRowid}`);
    }
    return created;
  }
}

export { WorkflowInstanceRepository };