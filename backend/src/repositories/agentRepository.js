/**
 * Agent Repository
 */
import { BaseRepository } from './base.js';

class AgentRepository extends BaseRepository {
  constructor() {
    super('agents.json');
  }
}

export { AgentRepository };
