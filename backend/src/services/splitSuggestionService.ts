import { splitSuggestionRepository } from '../repositories/splitSuggestionRepository.js';
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
  if (existing.status !== 'PENDING' && existing.status !== 'CONFIRMED') {
    throw new Error(`cannot edit suggestion in status ${existing.status}`);
  }
  // 已建行（child_task_id != null）按 child_task_id 在新数组里找：
  //   - 找不到 → 用户尝试删除已建行，拒绝
  //   - 找到但任意字段不一致 → 用户尝试改已建行，拒绝
  // 未建行允许任意删除/编辑/重排。
  const afterById = new Map<number, Suggestion>();
  for (const s of suggestions) {
    if (s.child_task_id != null) afterById.set(s.child_task_id, s);
  }
  for (const before of existing.suggestions) {
    if (before.child_task_id == null) continue;
    const after = afterById.get(before.child_task_id);
    if (!after) {
      throw new Error(`cannot remove locked row (child_task_id=${before.child_task_id})`);
    }
    // Field-order-sensitive equality. parseRow constructs each suggestion
    // with a fixed key order; the frontend's onAddTask uses the same order.
    // Both sides round-trip through this normalization before reaching here.
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      throw new Error(`row is locked (child_task_id=${before.child_task_id})`);
    }
  }
  await splitSuggestionRepository.update(id, { suggestions });
  return (await splitSuggestionRepository.findById(id))!;
}

async function confirm(id: number): Promise<{ tasks: number[]; suggestion: SplitSuggestionEntity; created_count: number }> {
  const existing = await splitSuggestionRepository.findById(id);
  if (!existing) throw new Error(`split suggestion ${id} not found`);
  if (existing.status !== 'PENDING' && existing.status !== 'CONFIRMED') {
    throw new Error(`cannot confirm suggestion in status ${existing.status}`);
  }

  // child_task_id != null 的行视为已建，跳过
  const skipIndices: number[] = [];
  const existingTaskIdByIndex: Record<number, number> = {};
  existing.suggestions.forEach((s, idx) => {
    if (s.child_task_id != null) {
      skipIndices.push(idx);
      existingTaskIdByIndex[idx] = s.child_task_id;
    }
  });

  // 全部已建：no-op
  if (skipIndices.length === existing.suggestions.length) {
    const updated = (await splitSuggestionRepository.findById(id))!;
    return {
      tasks: existing.suggestions
        .map(s => s.child_task_id)
        .filter((tid): tid is number => tid != null),
      suggestion: updated,
      created_count: 0,
    };
  }

  // 用 onCreated 回调逐任务回写 child_task_id
  const newSuggestions = [...existing.suggestions];

  const created = await taskService.batchCreate({
    parent_task_id: existing.parent_task_id,
    suggestions: existing.suggestions,
    skip_indices: skipIndices,
    existing_task_id_by_index: existingTaskIdByIndex,
    onCreated: async (originalIdx, task) => {
      newSuggestions[originalIdx] = {
        ...newSuggestions[originalIdx]!,
        child_task_id: task.id,
      };
      await splitSuggestionRepository.update(id, { suggestions: newSuggestions });
    },
  });

  // 全部成功后翻状态
  try {
    await splitSuggestionRepository.update(id, {
      status: 'CONFIRMED',
      confirmed_at: existing.confirmed_at ?? new Date().toISOString(),
    });
  } catch (err) {
    logger.warn('splitSuggestionService', `failed to update suggestion status after batchCreate: ${(err as Error).message}`);
  }

  // Auto-start 循环：维持现状的 worktree/auto_start 矩阵
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

  const updated = (await splitSuggestionRepository.findById(id))!;
  const allTaskIds = newSuggestions
    .map(s => s.child_task_id)
    .filter((tid): tid is number => tid != null);
  return { tasks: allTaskIds, suggestion: updated, created_count: created.length };
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
