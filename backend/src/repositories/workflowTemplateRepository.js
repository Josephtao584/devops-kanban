import fs from 'fs/promises';
import path from 'path';
import { STORAGE_PATH } from '../config/index.js';

class WorkflowTemplateRepository {
  constructor({ filePath } = {}) {
    this.filePath = filePath || path.join(STORAGE_PATH, 'workflow_template.json');
  }

  async get() {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async save(template) {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(template, null, 2), 'utf-8');
    return template;
  }
}

export { WorkflowTemplateRepository };
