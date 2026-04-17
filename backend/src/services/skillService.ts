import { SkillRepository } from '../repositories/skillRepository.js';
import type { SkillEntity } from '../types/entities.js';
import { existsSync, mkdirSync, rmSync, readdirSync, readFileSync, writeFileSync, statSync, renameSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import AdmZip from 'adm-zip';
import { ValidationError, NotFoundError, ConflictError } from '../utils/errors.js';

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
      throw new ValidationError('无效的文件路径', 'Invalid file path', { skillName, targetPath });
    }
    return skillDir;
  }

  async listSkills(): Promise<SkillEntity[]> {
    return await this.skillRepo.findAll();
  }

  async getSkill(id: number): Promise<SkillEntity | null> {
    return await this.skillRepo.findById(id);
  }

  private validateSkillName(name: string): void {
    if (!name || typeof name !== 'string' || name.trim() !== name) {
      throw new ValidationError('技能名称必须为非空字符串且无前后空格', 'Skill name must be a non-empty string without leading/trailing whitespace');
    }
    if (name.includes('..') || name.includes('/') || name.includes('\\')) {
      throw new ValidationError('技能名称不能包含 ".."、"/" 或 "\\"', 'Skill name cannot contain "..", "/", or "\\"');
    }
  }

  async createSkill(name: string, description?: string): Promise<SkillEntity> {
    this.validateSkillName(name);
    if (name.length > 200) {
      throw new ValidationError('技能名称不能超过 200 个字符', 'Skill name exceeds maximum length of 200 characters');
    }
    if (description && description.length > 5000) {
      throw new ValidationError('技能描述不能超过 5000 个字符', 'Skill description exceeds maximum length of 5000 characters');
    }
    const existing = await this.listSkills();
    if (existing.some(s => s.name === name)) {
      throw new ConflictError(`技能 "${name}" 已存在`, `Skill "${name}" already exists`, { skillName: name });
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

  async updateSkill(id: number, updates: { name?: string; description?: string }): Promise<SkillEntity | null> {
    const existing = await this.skillRepo.findById(id);
    if (!existing) return null;

    const updateData: Partial<Omit<SkillEntity, 'id' | 'created_at' | 'updated_at'>> = {};

    if (updates.description !== undefined) {
      if (updates.description.length > 5000) {
        throw new ValidationError('技能描述不能超过 5000 个字符', 'Skill description exceeds maximum length of 5000 characters');
      }
      updateData.description = updates.description;
    }

    if (updates.name !== undefined && updates.name !== existing.name) {
      if (updates.name.length > 200) {
        throw new ValidationError('技能名称不能超过 200 个字符', 'Skill name exceeds maximum length of 200 characters');
      }
      this.validateSkillName(updates.name);
      // Rename skill directory on disk
      const oldDir = this.getSkillDir(existing.name);
      const newDir = this.getSkillDir(updates.name);
      if (existsSync(oldDir)) {
        renameSync(oldDir, newDir);
      }
      updateData.name = updates.name;
      updateData.identifier = updates.name;
    }

    if (Object.keys(updateData).length === 0) return existing;
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
    }).map(entry => entry.split(sep).join('/'));
  }

  async readSkillFile(skillName: string, filePath: string): Promise<string> {
    const fullPath = resolve(this.getSkillDir(skillName), filePath);
    this.ensurePathInSkillDir(skillName, fullPath);
    if (!existsSync(fullPath)) {
      throw new NotFoundError('文件未找到', 'File not found', { skillName, filePath });
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
      throw new ValidationError('无效的技能 ZIP：ZIP 必须包含一级目录或根目录下的 SKILL.md', 'Invalid skill ZIP: ZIP must contain a first-level directory or SKILL.md at root');
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