import { SettingsRepository } from '../repositories/settingsRepository.js';

class SettingsService {
  private repo: SettingsRepository;

  constructor(deps?: { repo?: SettingsRepository }) {
    this.repo = deps?.repo || new SettingsRepository();
  }

  async get(key: string): Promise<string | null> {
    const setting = await this.repo.get(key);
    return setting?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.repo.set(key, value);
  }

  async getAll(): Promise<Record<string, string>> {
    const settings = await this.repo.getAll();
    const result: Record<string, string> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    return result;
  }

  async setMany(items: Array<{ key: string; value: string }>): Promise<void> {
    await this.repo.setMany(items);
  }

  async getWorkflowDispatchCron(): Promise<string> {
    return (await this.get('scheduler.workflow_dispatch_cron')) || '*/5 * * * *';
  }

  async getMaxConcurrentWorkflows(): Promise<number> {
    const val = await this.get('scheduler.max_concurrent_workflows');
    return val ? parseInt(val, 10) : 3;
  }

  async getMaxTasksPerExecution(): Promise<number> {
    const val = await this.get('scheduler.max_tasks_per_execution');
    return val ? parseInt(val, 10) : 10;
  }
}

export { SettingsService };
