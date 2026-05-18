import { splitSuggestionRepository } from '../repositories/splitSuggestionRepository.js';
import { taskRepository } from '../repositories/taskRepository.js';
import { taskService } from './taskService.js';
import { logger } from '../utils/logger.js';
import type { Suggestion, SplitSuggestionEntity } from '../types/entities.ts';

async function getByTask(taskId: number): Promise<SplitSuggestionEntity[]> {
  return splitSuggestionRepository.findByParentTask(taskId);
}

async function getPendingByTask(taskId: number): Promise<SplitSuggestionEntity | null> {
  return splitSuggestionRepository.findPendingByParentTask(taskId);
}

async function updateSuggestions(
  id: number,
  suggestions: Suggestion[],
): Promise<SplitSuggestionEntity> {
  const existing = await splitSuggestionRepository.findById(id);
  if (!existing) throw new Error(`split suggestion ${id} not found`);
  if (existing.status !== 'PENDING') {
    throw new Error(`cannot edit suggestion in status ${existing.status}`);
  }
  await splitSuggestionRepository.update(id, { suggestions });
  return (await splitSuggestionRepository.findById(id))!;
}

async function confirm(id: number): Promise<{ tasks: number[]; suggestion: SplitSuggestionEntity }> {
  const existing = await splitSuggestionRepository.findById(id);
  if (!existing) throw new Error(`split suggestion ${id} not found`);
  if (existing.status !== 'PENDING' && existing.status !== 'CONFIRMED') {
    throw new Error(`cannot confirm suggestion in status ${existing.status}`);
  }

  // Map already-created child tasks back to their original suggestion index
  // (matched by title, case-insensitive). Suggestions whose title matches an
  // existing child are skipped; remaining suggestions can still depend on
  // those existing children by their original index.
  const existingChildren = await taskRepository.findChildren(existing.parent_task_id);
  const existingByTitle = new Map(existingChildren.map(c => [c.title.toLowerCase(), c.id]));

  const skipIndices: number[] = [];
  const existingTaskIdByIndex: Record<number, number> = {};
  existing.suggestions.forEach((s, idx) => {
    const matchedId = existingByTitle.get(s.title.toLowerCase());
    if (matchedId !== undefined) {
      skipIndices.push(idx);
      existingTaskIdByIndex[idx] = matchedId;
    }
  });

  if (skipIndices.length === existing.suggestions.length) {
    // All suggestions already have children — nothing more to create.
    const updated = (await splitSuggestionRepository.findById(id))!;
    return { tasks: existingChildren.map(t => t.id), suggestion: updated };
  }

  const created = await taskService.batchCreate({
    parent_task_id: existing.parent_task_id,
    suggestions: existing.suggestions,
    skip_indices: skipIndices,
    existing_task_id_by_index: existingTaskIdByIndex,
  });

  try {
    await splitSuggestionRepository.update(id, {
      status: 'CONFIRMED',
      confirmed_at: new Date().toISOString(),
    });
  } catch (err) {
    // Child tasks are the source of truth; log and continue.
    logger.warn('splitSuggestionService', `failed to update suggestion status after batchCreate: ${(err as Error).message}`);
  }

  // Auto-start child tasks that are ready (status TODO). Failure to start
  // any single task must not abort the confirm — the task stays TODO for
  // the user to start manually. Each child suggestion carries two switches:
  //   - create_worktree: when not explicitly false, create a worktree first
  //   - auto_start:      when not explicitly false, start the workflow
  for (const { task, suggestion } of created) {
    if (task.status !== 'TODO') continue;

    if (suggestion.create_worktree !== false && !task.worktree_path) {
      try {
        await taskService.createWorktree(task.id);
      } catch (err) {
        logger.warn('splitSuggestionService', `failed to create worktree for task ${task.id}: ${(err as Error).message}`);
        continue;
      }
    }

    if (suggestion.auto_start === false) continue;
    const templateId = task.auto_execute_template_id;
    if (!templateId) continue;

    try {
      await taskService.startTask(task.id, { workflow_template_id: templateId });
    } catch (err) {
      logger.warn('splitSuggestionService', `failed to auto-start task ${task.id}: ${(err as Error).message}`);
    }
  }

  const allTasks = [...existingChildren, ...created.map((c) => c.task)];
  const updated = (await splitSuggestionRepository.findById(id))!;
  return { tasks: allTasks.map(t => t.id), suggestion: updated };
}

async function dismiss(id: number): Promise<SplitSuggestionEntity> {
  const existing = await splitSuggestionRepository.findById(id);
  if (!existing) throw new Error(`split suggestion ${id} not found`);
  if (existing.status !== 'PENDING') {
    throw new Error(`cannot dismiss suggestion in status ${existing.status}`);
  }
  await splitSuggestionRepository.update(id, { status: 'DISMISSED' });
  return (await splitSuggestionRepository.findById(id))!;
}

export const splitSuggestionService = {
  getByTask,
  getPendingByTask,
  updateSuggestions,
  confirm,
  dismiss,
};
