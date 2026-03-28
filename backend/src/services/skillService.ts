import { SkillRepository } from '../repositories/skillRepository.js';
import type { SkillEntity } from '../types/entities.js';
import { existsSync, mkdirSync, rmSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { resolve } from 'node:path';
import AdmZip from 'adm-zip';

class SkillService {
  skillRepo: SkillRepository;
  storagePath: string;

  constructor(options: { storagePath?: string; skillRepo?: SkillRepository } = {}) {
    this.storagePath = options.storagePath || process.cwd();
    this.skillRepo = options.skillRepo || new SkillRepository({ storagePath: this.storagePath });
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

    return await this.skillRepo.create({ name, description });
  }

  async updateSkill(id: number, description?: string): Promise<SkillEntity | null> {
    return await this.skillRepo.update(id, { description });
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
    if (!fullPath.startsWith(this.getSkillDir(skillName))) {
      const error: any = new Error('Invalid file path');
      error.statusCode = 400;
      throw error;
    }
    if (!existsSync(fullPath)) {
      const error: any = new Error('File not found');
      error.statusCode = 404;
      throw error;
    }
    return readFileSync(fullPath, 'utf-8');
  }

  async writeSkillFile(skillName: string, filePath: string, content: string): Promise<void> {
    const fullPath = resolve(this.getSkillDir(skillName), filePath);
    if (!fullPath.startsWith(this.getSkillDir(skillName))) {
      const error: any = new Error('Invalid file path');
      error.statusCode = 400;
      throw error;
    }
    // Create parent directories if they don't exist
    const parentDir = dirname(fullPath);
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }
    writeFileSync(fullPath, content, 'utf-8');
  }

  async uploadSkillZip(skillName: string, zipBuffer: Buffer): Promise<void> {
    const skillDir = this.getSkillDir(skillName);
    if (!existsSync(skillDir)) {
      mkdirSync(skillDir, { recursive: true });
    }

    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    for (const entry of entries) {
      const entryPath = resolve(skillDir, entry.entryName);
      if (!entryPath.startsWith(skillDir)) {
        const error: any = new Error(`Invalid path in zip: ${entry.entryName}`);
        error.statusCode = 400;
        throw error;
      }
    }

    zip.extractAllTo(skillDir, true);
  }
}

export { SkillService };