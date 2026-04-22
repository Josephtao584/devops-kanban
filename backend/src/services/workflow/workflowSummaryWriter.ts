import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const SUMMARY_THRESHOLD = 1000;

export async function writeSummaryToFile(
  worktreePath: string,
  stepId: string,
  summary: string,
): Promise<string | null> {
  if (summary.length <= SUMMARY_THRESHOLD) {
    return null;
  }

  const dir = resolve(worktreePath, '.kanban', 'summaries');
  await mkdir(dir, { recursive: true });
  const filePath = resolve(dir, `${stepId}.md`);
  await writeFile(filePath, summary, 'utf-8');

  return `.kanban/summaries/${stepId}.md`;
}
