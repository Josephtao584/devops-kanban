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

const sharedStateSchema = z.object({
  taskTitle: z.string(),
  taskDescription: z.string(),
  worktreePath: z.string(),
});

function buildWorkflowSharedState({ taskTitle, taskDescription, worktreePath }) {
  return {
    taskTitle,
    taskDescription,
    worktreePath,
  };
}

function buildStepExecutorInput({ state, inputData, upstreamStepIds }) {
  return {
    worktreePath: state.worktreePath,
    state,
    inputData,
    upstreamStepIds,
  };
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

  const dbPath = path.join(STORAGE_PATH, 'mastra.db');
  _mastra = new Mastra({
    storage: new LibSQLStore({
      id: 'kanban-workflow-store',
      url: `file:${dbPath}`,
    }),
  });

  _devWorkflow = buildDevWorkflow();

  _initialized = true;
  console.log('[Workflow] Mastra initialized with LibSQLStore');
}

function buildDevWorkflow() {
  const stepResultSchema = z.object({
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
    stateSchema: sharedStateSchema,
    execute: async ({ inputData, state }) => {
      console.log(`[Workflow] Step "requirement-design" started`);
      console.log(`[Workflow]   Task: #${inputData.taskId} - ${inputData.taskTitle}`);
      console.log(`[Workflow]   Worktree: ${state.worktreePath}`);

      return await executeWorkflowStep({
        context: getWorkflowExecutionContext(),
        stepId: 'requirement-design',
        ...buildStepExecutorInput({
          state,
          inputData,
          upstreamStepIds: [],
        }),
      });
    },
  });

  const codeDevelopmentStep = createStep({
    id: 'code-development',
    inputSchema: stepResultSchema,
    outputSchema: stepResultSchema,
    stateSchema: sharedStateSchema,
    execute: async ({ inputData, state }) => {
      console.log(`[Workflow] Step "code-development" started`);
      console.log(`[Workflow]   Upstream summary: ${inputData.summary}`);

      return await executeWorkflowStep({
        context: getWorkflowExecutionContext(),
        stepId: 'code-development',
        ...buildStepExecutorInput({
          state,
          inputData,
          upstreamStepIds: ['requirement-design'],
        }),
      });
    },
  });

  const testingStep = createStep({
    id: 'testing',
    inputSchema: stepResultSchema,
    outputSchema: stepResultSchema,
    stateSchema: sharedStateSchema,
    execute: async ({ inputData, state }) => {
      console.log(`[Workflow] Step "testing" started`);
      return await executeWorkflowStep({
        context: getWorkflowExecutionContext(),
        stepId: 'testing',
        ...buildStepExecutorInput({
          state,
          inputData,
          upstreamStepIds: ['code-development'],
        }),
      });
    },
  });

  const codeReviewStep = createStep({
    id: 'code-review',
    inputSchema: stepResultSchema,
    outputSchema: stepResultSchema,
    stateSchema: sharedStateSchema,
    execute: async ({ inputData, state }) => {
      console.log(`[Workflow] Step "code-review" started`);
      return await executeWorkflowStep({
        context: getWorkflowExecutionContext(),
        stepId: 'code-review',
        ...buildStepExecutorInput({
          state,
          inputData,
          upstreamStepIds: ['testing'],
        }),
      });
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
    stateSchema: sharedStateSchema,
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

export { buildWorkflowSharedState, buildStepExecutorInput, sharedStateSchema };
