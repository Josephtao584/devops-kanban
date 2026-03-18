/**
 * Agent Repository
 */
const { BaseRepository } = require('./base');

class AgentRepository extends BaseRepository {
  constructor() {
    super('agents.json');
  }
}

module.exports = { AgentRepository };
