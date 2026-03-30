import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { STORAGE_PATH } from '../config/index.js';

function copyDirRecursive(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = resolve(src, entry.name);
    const destPath = resolve(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      const content = readFileSync(srcPath, 'utf-8');
      writeFileSync(destPath, content, 'utf-8');
    }
  }
}

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
    const sourceDir = resolve(STORAGE_PATH, 'skills', skillName);
    const targetDir = resolve(targetSkillsDir, skillName);

    // 已存在则跳过
    if (existsSync(targetDir)) {
      console.log(`[skillSync] Skill "${skillName}" already exists in project, skipping`);
      continue;
    }

    // 复制 skill 目录
    if (existsSync(sourceDir)) {
      copyDirRecursive(sourceDir, targetDir);
      console.log(`[skillSync] Copied skill "${skillName}" to project: ${targetDir}`);
    } else {
      console.warn(`[skillSync] Skill "${skillName}" not found in data/skills, skipping`);
    }
  }
}