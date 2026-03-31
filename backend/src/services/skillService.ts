import { SkillRepository } from '../repositories/skillRepository.js';
import type { SkillEntity } from '../types/entities.js';
import { existsSync, mkdirSync, rmSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import AdmZip from 'adm-zip';

class SkillService {
  skillRepo: SkillRepository;
  storagePath: string;

  constructor(options: { storagePath?: string; skillRepo?: SkillRepository } = {}) {
    this.storagePath = options.storagePath || process.cwd();
    this.skillRepo = options.skillRepo || new SkillRepository();
  }

  private ensurePathInSkillDir(skillName: string, targetPath: string): string {
    const skillDir = this.getSkillDir(skillName);
    const relativePath = relative(skillDir, targetPath);
    if (relativePath === '..' || relativePath.startsWith(`..${sep}`)) {
      const error: any = new Error('Invalid file path');
      error.statusCode = 400;
      throw error;
    }
    return skillDir;
  }

  async listSkills(): Promise<SkillEntity[]> {
    return await this.skillRepo.findAll();
  }

  async getSkill(id: number): Promise<SkillEntity | null> {
    return await this.skillRepo.findById(id);
  }

  async createSkill(name: string, description?: string): Promise<SkillEntity> {
    const existing = await this.listSkills();
    if (existing.some(s => s.name === name)) {
      const error: any = new Error(`Skill "${name}" already exists`);
      error.statusCode = 409;
      throw error;
    }

    const skillDir = this.getSkillDir(name);
    if (!existsSync(skillDir)) {
      mkdirSync(skillDir, { recursive: true });
    }

    const entityData: Omit<SkillEntity, 'id' | 'created_at' | 'updated_at'> = {
      name,
      identifier: name,
      ...(description ? { description } : {})
    };
    return await this.skillRepo.create(entityData);
  }

  async updateSkill(id: number, description?: string): Promise<SkillEntity | null> {
    const updateData: Partial<Omit<SkillEntity, 'id' | 'created_at' | 'updated_at'>> = description
      ? { description }
      : {};
    return await this.skillRepo.update(id, updateData);
  }

  async deleteSkill(id: number): Promise<boolean> {
    const skill = await this.skillRepo.findById(id);
    if (!skill) {
      return false;
    }

    const deleted = await this.skillRepo.delete(id);
    if (deleted) {
      const skillDir = this.getSkillDir(skill.name);
      if (existsSync(skillDir)) {
        rmSync(skillDir, { recursive: true });
      }
    }
    return deleted;
  }

  getSkillDir(name: string): string {
    return resolve(this.storagePath, 'skills', name);
  }

  async listSkillFiles(skillName: string): Promise<string[]> {
    const skillDir = this.getSkillDir(skillName);
    if (!existsSync(skillDir)) {
      return [];
    }
    const allEntries = readdirSync(skillDir, { recursive: true })
      .filter((path): path is string => typeof path === 'string');

    return allEntries.filter(entry => {
      const fullPath = resolve(skillDir, entry);
      return existsSync(fullPath) && statSync(fullPath).isFile();
    });
  }

  async readSkillFile(skillName: string, filePath: string): Promise<string> {
    const fullPath = resolve(this.getSkillDir(skillName), filePath);
    this.ensurePathInSkillDir(skillName, fullPath);
    if (!existsSync(fullPath)) {
      const error: any = new Error('File not found');
      error.statusCode = 404;
      throw error;
    }
    return readFileSync(fullPath, 'utf-8');
  }

  async writeSkillFile(skillName: string, filePath: string, content: string): Promise<void> {
    const fullPath = resolve(this.getSkillDir(skillName), filePath);
    this.ensurePathInSkillDir(skillName, fullPath);
    const parentDir = dirname(fullPath);
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }
    writeFileSync(fullPath, content, 'utf-8');
  }

  async uploadSkillZip(skillName: string, zipBuffer: Buffer): Promise<void> {
    await this.extractSkillZip(skillName, zipBuffer);
  }

  async parseSkillFromZip(zipBuffer: Buffer): Promise<{ name: string; description?: string }> {
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();
    const firstLevelDir = this._getFirstLevelDir(entries);

    if (!firstLevelDir) {
      // 检查是否有 SKILL.md 在根目录
      const skillMdEntry = zip.getEntry('SKILL.md');
      if (skillMdEntry) {
        const content = skillMdEntry.getData().toString('utf-8');
        const nameMatch = content.match(/^---\nname:\s*(.+)/i);
        const descMatch = content.match(/description:\s*(.+)/i);
        const extractedName = nameMatch && nameMatch[1] ? nameMatch[1].trim() : 'unnamed-skill';
        const extractedDesc = descMatch && descMatch[1] ? descMatch[1].trim() : undefined;
        return {
          name: extractedName,
          ...(extractedDesc ? { description: extractedDesc } : {})
        };
      }
      const error: any = new Error('Invalid skill ZIP: ZIP must contain a first-level directory or SKILL.md at root');
      error.statusCode = 400;
      throw error;
    }

    const name = firstLevelDir.replace(/\/$/, '');
    let description: string | undefined = undefined;

    // 尝试从 SKILL.md 解析 description
    const skillMdEntry = zip.getEntry(`${firstLevelDir}SKILL.md`);
    if (skillMdEntry) {
      const content = skillMdEntry.getData().toString('utf-8');
      const descMatch = content.match(/description:\s*(.+)/i);
      if (descMatch && descMatch[1]) {
        description = descMatch[1].trim();
      }
    }

    return { name, ...(description ? { description } : {}) };
  }

  async createSkillFromZip(zipBuffer: Buffer): Promise<SkillEntity> {
    const { name, description } = await this.parseSkillFromZip(zipBuffer);
    return await this.createSkill(name, description);
  }

  async extractSkillZip(skillName: string, zipBuffer: Buffer): Promise<void> {
    const skillDir = this.getSkillDir(skillName);
    if (!existsSync(skillDir)) {
      mkdirSync(skillDir, { recursive: true });
    }

    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();
    const firstLevelDir = this._getFirstLevelDir(entries);

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      if (entry.entryName.startsWith('__MACOSX/')) continue;

      let targetPath = entry.entryName;
      if (firstLevelDir && targetPath.startsWith(firstLevelDir)) {
        targetPath = targetPath.slice(firstLevelDir.length).replace(/^\//, '');
      }

      if (!targetPath) continue;

      const fullPath = resolve(skillDir, targetPath);
      this.ensurePathInSkillDir(skillName, fullPath);
      const parentDir = dirname(fullPath);
      if (!existsSync(parentDir)) {
        mkdirSync(parentDir, { recursive: true });
      }
      zip.extractEntryTo(entry, parentDir, false, true);
    }
  }

  private _getFirstLevelDir(entries: AdmZip.IZipEntry[]): string | null {
    // 过滤掉 __MACOSX 目录（macOS 系统文件）和目录类型的条目
    const files = entries.filter(e => !e.isDirectory && e.entryName.includes('/') && !e.entryName.startsWith('__MACOSX/'));
    if (!files.length) return null;
    const firstParts = [...new Set(files.map(e => e.entryName.split('/')[0]))];
    return firstParts.length === 1 ? firstParts[0] + '/' : null;
  }
}

export { SkillService };