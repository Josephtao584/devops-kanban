import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { STORAGE_PATH } from '../config/index.js';
import { logger } from './logger.js';

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
    logger.info('SkillSync', `Created directory: ${targetSkillsDir}`);
  }

  for (const skillName of skillNames) {
    const sourceDir = resolve(STORAGE_PATH, 'skills', skillName);
    const targetDir = resolve(targetSkillsDir, skillName);

    // 已存在则跳过
    if (existsSync(targetDir)) {
      logger.info('SkillSync', `Skill "${skillName}" already exists in project, skipping`);
      continue;
    }

    // 复制 skill 目录
    if (existsSync(sourceDir)) {
      copyDirRecursive(sourceDir, targetDir);
      logger.info('SkillSync', `Copied skill "${skillName}" to project: ${targetDir}`);
    } else {
      logger.warn('SkillSync', `Skill "${skillName}" not found in data/skills, skipping`);
    }
  }
}

interface SkillManifest {
  runId: number;
  stepId: string;
  installedSkills: string[];
  updatedAt: string;
}

async function readSkillManifest(skillsDir: string): Promise<SkillManifest | null> {
  const manifestPath = resolve(skillsDir, '.workflow-manifest.json');
  if (!existsSync(manifestPath)) {
    return null;
  }
  try {
    const raw = readFileSync(manifestPath, 'utf-8');
    return JSON.parse(raw) as SkillManifest;
  } catch (err) {
    logger.warn('SkillSync', `Failed to read manifest: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function writeSkillManifest(skillsDir: string, data: SkillManifest): Promise<void> {
  const manifestPath = resolve(skillsDir, '.workflow-manifest.json');
  try {
    if (!existsSync(skillsDir)) {
      mkdirSync(skillsDir, { recursive: true });
    }
    writeFileSync(manifestPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    logger.warn('SkillSync', `Failed to write manifest: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function cleanupSkillsByManifest(skillsDir: string, currentRunId: number): Promise<void> {
  const manifest = await readSkillManifest(skillsDir);
  if (!manifest || manifest.runId !== currentRunId) {
    return;
  }

  for (const skillName of manifest.installedSkills) {
    const skillDir = resolve(skillsDir, skillName);
    try {
      if (existsSync(skillDir)) {
        rmSync(skillDir, { recursive: true, force: true });
        logger.info('SkillSync', `Cleaned up skill "${skillName}" from previous step`);
      }
    } catch (err) {
      logger.warn('SkillSync', `Failed to cleanup skill "${skillName}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Remove manifest file
  const manifestPath = resolve(skillsDir, '.workflow-manifest.json');
  try {
    if (existsSync(manifestPath)) {
      rmSync(manifestPath, { force: true });
    }
  } catch (err) {
    logger.warn('SkillSync', `Failed to remove manifest: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export { cleanupSkillsByManifest, writeSkillManifest, readSkillManifest };
export type { SkillManifest };
