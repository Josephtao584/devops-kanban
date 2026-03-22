import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { STORAGE_PATH } from '../config/index.js';
import type { WorkflowTemplateEntity } from '../types/entities.ts';

class WorkflowTemplateRepository {
  filePath: string;

  constructor({ filePath }: { filePath?: string } = {}) {
    this.filePath = filePath || path.join(STORAGE_PATH as string, 'workflow_template.json');
  }

  async get(): Promise<WorkflowTemplateEntity | null> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(content) as WorkflowTemplateEntity;
    } catch {
      return null;
    }
  }

  async save(template: WorkflowTemplateEntity): Promise<WorkflowTemplateEntity> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(template, null, 2), 'utf-8');
    return template;
  }
}

export { WorkflowTemplateRepository };
