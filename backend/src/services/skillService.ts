import { SkillRepository } from '../repositories/skillRepository.js';
import type { SkillEntity } from '../types/entities.js';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

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
    // 检查是否已存在同名 skill
    const existing = await this.listSkills();
    if (existing.some(s => s.name === name)) {
      const error: any = new Error(`Skill "${name}" already exists`);
      error.statusCode = 409;
      throw error;
    }

    // 初始化 skill 目录
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
      // 删除 skill 目录
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
}

export { SkillService };