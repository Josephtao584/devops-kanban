import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { logger } from '../../utils/logger.js';

const SUMMARY_THRESHOLD = 1000;
const ERROR_THRESHOLD = 2000;

export async function writeSummaryToFile(
  worktreePath: string,
  stepId: string,
  summary: string,
): Promise<string | null> {
  if (summary.length <= SUMMARY_THRESHOLD) {
    return null;
  }

  try {
    const dir = resolve(worktreePath, '.kanban', 'summaries');
    await mkdir(dir, { recursive: true });
    const filePath = resolve(dir, `${stepId}.md`);
    await writeFile(filePath, summary, 'utf-8');
    return `.kanban/summaries/${stepId}.md`;
  } catch (err) {
    logger.warn('WorkflowSummaryWriter', `Failed to write summary for step ${stepId}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

export async function writeErrorToFile(
  worktreePath: string,
  runId: number,
  stepId: string,
  error: string,
): Promise<string | null> {
  if (error.length <= ERROR_THRESHOLD) {
    return null;
  }

  try {
    const dir = resolve(worktreePath, '.kanban', 'errors');
    await mkdir(dir, { recursive: true });
    const filename = `${runId}_${stepId}.md`;
    const filePath = resolve(dir, filename);
    await writeFile(filePath, error, 'utf-8');
    return `.kanban/errors/${filename}`;
  } catch (err) {
    logger.warn('WorkflowSummaryWriter', `Failed to write error for step ${stepId}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
