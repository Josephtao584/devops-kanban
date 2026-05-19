import { BaseRepository } from './base.js';
import type { SplitSuggestionEntity } from '../types/entities.js';

class SplitSuggestionRepository extends BaseRepository<SplitSuggestionEntity> {
  constructor() {
    super('split_suggestions');
  }

  protected override parseRow(row: Record<string, unknown>): SplitSuggestionEntity {
    const rawSuggestions = row.suggestions ? JSON.parse(row.suggestions as string) : [];
    const suggestions = (rawSuggestions as Array<Record<string, unknown>>).map((s) => ({
      title: (s.title as string) ?? '',
      description: (s.description as string) ?? '',
      template_id: (s.template_id as string | null) ?? null,
      linked_project_id: (s.linked_project_id as number | null) ?? null,
      target_repo_url: (s.target_repo_url as string | null) ?? null,
      depends_on_indices: Array.isArray(s.depends_on_indices) ? (s.depends_on_indices as number[]) : [],
      enabled: s.enabled !== false,
      create_worktree: s.create_worktree !== false,
      auto_start: s.auto_start !== false,
      work_dir: (s.work_dir as string | null) ?? null,
    }));
    return { ...row, suggestions } as SplitSuggestionEntity;
  }

  protected override serializeRow(
    entity: Partial<SplitSuggestionEntity>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = { ...entity };
    if (entity.suggestions !== undefined) {
      result.suggestions = JSON.stringify(entity.suggestions);
    }
    return result;
  }

  async findByParentTask(parentTaskId: number): Promise<SplitSuggestionEntity[]> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM split_suggestions WHERE parent_task_id = ? ORDER BY created_at DESC',
      args: [parentTaskId],
    });
    return result.rows.map(row => this.parseRow(row as Record<string, unknown>));
  }

  async findPendingByParentTask(parentTaskId: number): Promise<SplitSuggestionEntity | null> {
    const result = await this.client.execute({
      sql: `SELECT * FROM split_suggestions WHERE parent_task_id = ? AND status = 'PENDING' ORDER BY created_at DESC LIMIT 1`,
      args: [parentTaskId],
    });
    const row = result.rows[0];
    return row ? this.parseRow(row as Record<string, unknown>) : null;
  }
}

export const splitSuggestionRepository = new SplitSuggestionRepository();
export { SplitSuggestionRepository };
