import { existsSync, cpSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export async function ensureSkillsInWorktree(skillNames: string[], projectPath: string): Promise<void> {
  if (!skillNames || skillNames.length === 0) {
    return;
  }

  const targetSkillsDir = resolve(projectPath, '.claude', 'skills');

  // 确保 .claude/skills 目录存在
  if (!existsSync(targetSkillsDir)) {
    mkdirSync(targetSkillsDir, { recursive: true });
    console.log(`[skillSync] Created directory: ${targetSkillsDir}`);
  }

  for (const skillName of skillNames) {
    const sourceDir = resolve(process.cwd(), 'data', 'skills', skillName);
    const targetDir = resolve(targetSkillsDir, skillName);

    // 已存在则跳过
    if (existsSync(targetDir)) {
      console.log(`[skillSync] Skill "${skillName}" already exists in project, skipping`);
      continue;
    }

    // 复制 skill 目录
    if (existsSync(sourceDir)) {
      cpSync(sourceDir, targetDir, { recursive: true });
      console.log(`[skillSync] Copied skill "${skillName}" to project: ${targetDir}`);
    } else {
      console.warn(`[skillSync] Skill "${skillName}" not found in data/skills, skipping`);
    }
  }
}