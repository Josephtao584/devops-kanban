import * as path from 'node:path';
import { z } from 'zod';
import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { STORAGE_PATH } from '../../config/index.js';
import { executeWorkflowStep } from './workflowStepExecutor.js';
import { getWorkflowExecutionContext } from './workflowExecutionContext.js';

const sharedStateSchema = z.object({
  taskTitle: z.string(),
  taskDescription: z.string(),
  worktreePath: z.string(),
});

function buildWorkflowSharedState({
  taskTitle,
  taskDescription,
  worktreePath,
}: {
  taskTitle: string;
  taskDescription: string;
  worktreePath: string;
}) {
  return {
    taskTitle,
    taskDescription,
    worktreePath,
  };
}

function buildStepExecutorInput({
  state,
  inputData,
  upstreamStepIds,
}: {
  state: { worktreePath: string; taskTitle: string; taskDescription: string };
  inputData: Record<string, unknown>;
  upstreamStepIds: string[];
}) {
  return {
    worktreePath: state.worktreePath,
    state,
    inputData,
    upstreamStepIds,
  };
}

let _mastra: Mastra | null = null;
let _devWorkflow: ReturnType<typeof buildDevWorkflow> | null = null;
let _initialized = false;

export async function initWorkflows() {
  if (_initialized) return;

  const dbPath = path.join(STORAGE_PATH as string, 'mastra.db');
  _mastra = new Mastra({
    storage: new LibSQLStore({
      id: 'kanban-workflow-store',
      url: `file:${dbPath}`,
    }),
  });

  _devWorkflow = buildDevWorkflow();
  _initialized = true;
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
    execute: async ({ inputData, state }: { inputData: { taskId: number; taskTitle: string; taskDescription: string; worktreePath: string }; state: { taskTitle: string; taskDescription: string; worktreePath: string } }) => {
      return await executeWorkflowStep({
        ...(getWorkflowExecutionContext() ? { context: getWorkflowExecutionContext() || undefined } : {}),
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
    execute: async ({ inputData, state }: { inputData: { summary: string }; state: { taskTitle: string; taskDescription: string; worktreePath: string } }) => {
      return await executeWorkflowStep({
        ...(getWorkflowExecutionContext() ? { context: getWorkflowExecutionContext() || undefined } : {}),
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
    execute: async ({ inputData, state }: { inputData: { summary: string }; state: { taskTitle: string; taskDescription: string; worktreePath: string } }) => {
      return await executeWorkflowStep({
        ...(getWorkflowExecutionContext() ? { context: getWorkflowExecutionContext() || undefined } : {}),
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
    execute: async ({ inputData, state }: { inputData: { summary: string }; state: { taskTitle: string; taskDescription: string; worktreePath: string } }) => {
      return await executeWorkflowStep({
        ...(getWorkflowExecutionContext() ? { context: getWorkflowExecutionContext() || undefined } : {}),
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
