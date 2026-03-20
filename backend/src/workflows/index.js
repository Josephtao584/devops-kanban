/**
 * Mastra instance initialization
 *
 * Provides a singleton Mastra instance with LibSQLStore for workflow state persistence.
 */

import path from 'path';
import { z } from 'zod';
import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { STORAGE_PATH } from '../config/index.js';
import { executeWorkflowStep } from '../services/workflowStepExecutor.js';
import { getWorkflowExecutionContext } from '../services/workflowExecutionContext.js';

export function attachWorktreePath(result, worktreePath) {
  return {
    ...result,
    worktreePath,
  };
}

export function resolveStepWorktreePath(inputData, context = getWorkflowExecutionContext()) {
  return inputData.worktreePath || context?.worktreePath || process.cwd();
}

let _mastra = null;
let _devWorkflow = null;
let _initialized = false;

/**
 * Initialize Mastra and register workflows.
 * Call once at server startup.
 */
export async function initWorkflows() {
  if (_initialized) return;

  // 1. Create Mastra instance with storage
  const dbPath = path.join(STORAGE_PATH, 'mastra.db');
  _mastra = new Mastra({
    storage: new LibSQLStore({
      id: 'kanban-workflow-store',
      url: `file:${dbPath}`,
    }),
  });

  // 2. Build dev workflow
  _devWorkflow = buildDevWorkflow();

  _initialized = true;
  console.log('[Workflow] Mastra initialized with LibSQLStore');
}

function buildDevWorkflow() {
  const stepResultSchema = z.object({
    changedFiles: z.array(z.string()),
    summary: z.string(),
  });

  const requirementDesignStep = createStep({
    id: 'requirement-design',
    inputSchema: z.object({
      taskId: z.number(),
      taskTitle: z.string(),
      taskDescription: z.string(),
      worktreePath: z.string(),
    }),
    outputSchema: stepResultSchema,
    execute: async ({ inputData }) => {
      console.log(`[Workflow] Step "requirement-design" started`);
      console.log(`[Workflow]   Task: #${inputData.taskId} - ${inputData.taskTitle}`);
      console.log(`[Workflow]   Worktree: ${inputData.worktreePath}`);

      return attachWorktreePath(await executeWorkflowStep({
        context: getWorkflowExecutionContext(),
        stepId: 'requirement-design',
        worktreePath: inputData.worktreePath,
        taskTitle: inputData.taskTitle,
        taskDescription: inputData.taskDescription,
      }), inputData.worktreePath);
    },
  });

  const codeDevelopmentStep = createStep({
    id: 'code-development',
    inputSchema: z.object({
      changedFiles: z.array(z.string()),
      summary: z.string(),
      worktreePath: z.string().optional(),
    }),
    outputSchema: stepResultSchema,
    execute: async ({ inputData }) => {
      console.log(`[Workflow] Step "code-development" started`);
      console.log(`[Workflow]   Previous changed files: ${inputData.changedFiles.join(', ')}`);

      return await executeWorkflowStep({
        context: getWorkflowExecutionContext(),
        stepId: 'code-development',
        worktreePath: resolveStepWorktreePath(inputData),
        taskTitle: '代码开发',
        taskDescription: inputData.summary,
        previousSummary: inputData.summary,
      });
    },
  });

  const testingStep = createStep({
    id: 'testing',
    inputSchema: stepResultSchema,
    outputSchema: stepResultSchema,
    execute: async ({ inputData }) => {
      console.log(`[Workflow] Step "testing" started`);
      return {
        changedFiles: inputData.changedFiles,
        summary: `[Mock] Testing skipped. ${inputData.summary}`,
      };
    },
  });

  const codeReviewStep = createStep({
    id: 'code-review',
    inputSchema: stepResultSchema,
    outputSchema: stepResultSchema,
    execute: async ({ inputData }) => {
      console.log(`[Workflow] Step "code-review" started`);
      return {
        changedFiles: inputData.changedFiles,
        summary: `[Mock] Code review skipped. ${inputData.summary}`,
      };
    },
  });

  const workflow = createWorkflow({
    id: 'dev-workflow-v1',
    inputSchema: z.object({
      taskId: z.number(),
      taskTitle: z.string(),
      taskDescription: z.string(),
      worktreePath: z.string(),
    }),
    outputSchema: stepResultSchema,
  })
    .then(requirementDesignStep)
    .then(codeDevelopmentStep)
    .then(testingStep)
    .then(codeReviewStep);

  workflow.commit();
  return workflow;
}

export function getMastra() {
  if (!_mastra) throw new Error('Mastra not initialized. Call initWorkflows() first.');
  return _mastra;
}

export function getDevWorkflow() {
  if (!_devWorkflow) throw new Error('Workflow not initialized. Call initWorkflows() first.');
  return _devWorkflow;
}
