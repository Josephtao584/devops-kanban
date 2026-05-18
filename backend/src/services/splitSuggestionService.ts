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

  // Get already-created children (from a previous partial confirm).
  const existingChildren = await taskRepository.findChildren(existing.parent_task_id);
  const existingChildTitles = new Set(existingChildren.map(c => c.title.toLowerCase()));

  // Filter out suggestions that already have matching child tasks, so
  // re-confirming after a partial confirm doesn't fail or create duplicates.
  const newSuggestions = existing.suggestions.filter(
    s => !existingChildTitles.has(s.title.toLowerCase()),
  );

  if (newSuggestions.length === 0) {
    // All suggestions already have children — nothing more to create.
    const updated = (await splitSuggestionRepository.findById(id))!;
    return { tasks: existingChildren.map(t => t.id), suggestion: updated };
  }

  const tasks = await taskService.batchCreate({
    parent_task_id: existing.parent_task_id,
    suggestions: newSuggestions,
    existing_child_ids: existingChildren.map(t => t.id),
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
  // the user to start manually.
  for (const task of tasks) {
    if (task.status !== 'TODO') continue;
    const templateId = task.auto_execute_template_id;
    if (!templateId) continue;
    try {
      // Ensure worktree exists before starting (parity with manual start flow)
      if (!task.worktree_path) {
        await taskService.createWorktree(task.id);
      }
      await taskService.startTask(task.id, { workflow_template_id: templateId });
    } catch (err) {
      logger.warn('splitSuggestionService', `failed to auto-start task ${task.id}: ${(err as Error).message}`);
    }
  }

  const allTasks = [...existingChildren, ...tasks];
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
