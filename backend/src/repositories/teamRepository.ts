import { BaseRepository } from './base.js';
import type { TeamEntity, ProjectEntity } from '../types/entities.js';

class TeamRepository extends BaseRepository<TeamEntity> {
  constructor() {
    super('teams');
  }

  async findProjectsByTeam(teamId: number): Promise<ProjectEntity[]> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM projects WHERE team_id = ? ORDER BY repo_role ASC, name ASC',
      args: [teamId],
    });
    return result.rows.map(row => {
      let env: Record<string, string> = {};
      if (row.env) {
        try {
          const parsed = JSON.parse(row.env as string);
          if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            env = parsed;
          }
        } catch { /* ignore */ }
      }
      return { ...row, env } as unknown as ProjectEntity;
    });
  }
}

export { TeamRepository };
export const teamRepository = new TeamRepository();
