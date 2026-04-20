import { BundleService } from './bundleService.js';
import AdmZip from 'adm-zip';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { WorkflowTemplateRepository } from '../repositories/workflowTemplateRepository.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

type PresetRegistryEntry = {
  name: string;
  displayName: string;
  description: string;
  tags: string[];
  filename: string;
};

type PresetListItem = {
  name: string;
  displayName: string;
  description: string;
  tags: string[];
  filename: string;
  installed: boolean;
};

type ImportResult = {
  imported: { templates: number; agents: number; skills: number; mcpServers: number };
  skipped: { templates: number; agents: number; skills: number; mcpServers: number };
};

class PresetService {
  kanbanTemplatePath: string;
  storagePath: string;
  templateRepo: WorkflowTemplateRepository;

  constructor(options: {
    kanbanTemplatePath?: string;
    storagePath?: string;
    templateRepo?: WorkflowTemplateRepository;
  } = {}) {
    this.kanbanTemplatePath = options.kanbanTemplatePath || resolve(process.cwd(), '..', 'kanban-template');
    this.storagePath = options.storagePath || resolve(process.cwd(), '..', 'data');
    this.templateRepo = options.templateRepo || new WorkflowTemplateRepository();
  }

  async listPresets(): Promise<PresetListItem[]> {
    const registryPath = resolve(this.kanbanTemplatePath, 'registry.json');
    if (!existsSync(registryPath)) {
      return [];
    }

    const raw = readFileSync(registryPath, 'utf-8');
    const registry: PresetRegistryEntry[] = JSON.parse(raw);

    const existingTemplates = await this.templateRepo.findAll();
    const existingTemplateIds = new Set(existingTemplates.map(t => t.template_id));

    return registry.map(preset => {
      const zipPath = resolve(this.kanbanTemplatePath, preset.filename);
      const templateIds = this.extractTemplateIdsFromZip(zipPath);
      const installed = templateIds.length > 0 && templateIds.every(id => existingTemplateIds.has(id));

      return {
        name: preset.name,
        displayName: preset.displayName,
        description: preset.description,
        tags: preset.tags,
        filename: preset.filename,
        installed,
      };
    });
  }

  async importPreset(name: string, strategy: 'skip' | 'overwrite' | 'copy'): Promise<ImportResult> {
    const registryPath = resolve(this.kanbanTemplatePath, 'registry.json');
    if (!existsSync(registryPath)) {
      throw new NotFoundError(
        '未找到预设注册表',
        'Preset registry not found',
        { path: registryPath }
      );
    }

    const raw = readFileSync(registryPath, 'utf-8');
    const registry: PresetRegistryEntry[] = JSON.parse(raw);
    const preset = registry.find(p => p.name === name);

    if (!preset) {
      throw new NotFoundError(
        `未找到预设: ${name}`,
        `Preset not found: ${name}`,
        { name }
      );
    }

    const zipPath = resolve(this.kanbanTemplatePath, preset.filename);
    if (!existsSync(zipPath)) {
      throw new ValidationError(
        `预设 ZIP 文件不存在: ${preset.filename}`,
        `Preset ZIP file not found: ${preset.filename}`,
        { filename: preset.filename }
      );
    }

    const zipBuffer = readFileSync(zipPath);
    const bundleService = new BundleService({ storagePath: this.storagePath });
    const result = await bundleService.confirmImportFromZip(zipBuffer, strategy);

    return result;
  }

  private extractTemplateIdsFromZip(zipPath: string): string[] {
    if (!existsSync(zipPath)) return [];

    try {
      const zip = new AdmZip(zipPath);
      const entry = zip.getEntry('bundle.json');
      if (!entry) return [];

      const data = JSON.parse(entry.getData().toString('utf-8'));
      if (!data.templates || !Array.isArray(data.templates)) return [];

      return data.templates.map((t: { template_id: string }) => t.template_id);
    } catch {
      return [];
    }
  }
}

export { PresetService };
