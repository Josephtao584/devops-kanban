import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { STORAGE_PATH } from '../config/index.js';
import type { WorkflowTemplateEntity } from '../types/entities.ts';

class WorkflowTemplateRepository {
  filePath: string;
  legacyFilePath: string;

  constructor({
    filePath,
    legacyFilePath,
  }: {
    filePath?: string;
    legacyFilePath?: string;
  } = {}) {
    this.filePath = filePath || path.join(STORAGE_PATH as string, 'workflow_templates.json');
    this.legacyFilePath = legacyFilePath || path.join(STORAGE_PATH as string, 'workflow_template.json');
  }

  _wrapReadError(message: string, cause: unknown) {
    const error = new Error(message);
    Object.assign(error, { cause });
    return error;
  }

  async readAll(): Promise<WorkflowTemplateEntity[]> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(content) as unknown;
      if (!Array.isArray(parsed)) {
        throw new Error('Workflow template storage must contain an array');
      }
      return parsed as WorkflowTemplateEntity[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
        return [];
      }

      throw this._wrapReadError('Failed to read workflow template storage', error);
    }
  }

  async hasPrimaryStorage(): Promise<boolean> {
    try {
      await fs.access(this.filePath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
        return false;
      }

      throw this._wrapReadError('Failed to access workflow template storage', error);
    }
  }


  async saveAll(templates: WorkflowTemplateEntity[]): Promise<WorkflowTemplateEntity[]> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(templates, null, 2), 'utf-8');
    return templates;
  }

  async findById(templateId: string): Promise<WorkflowTemplateEntity | null> {
    const templates = await this.readAll();
    return templates.find((template) => template.template_id === templateId) ?? null;
  }

  async readLegacy(): Promise<WorkflowTemplateEntity | null> {
    try {
      const content = await fs.readFile(this.legacyFilePath, 'utf-8');
      const parsed = JSON.parse(content) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
      }
      return parsed as WorkflowTemplateEntity;
    } catch (error) {
      if ((error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
        return null;
      }

      throw this._wrapReadError('Failed to read legacy workflow template storage', error);
    }
  }
}

export { WorkflowTemplateRepository };
