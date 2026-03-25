import * as path from 'node:path';
import { z } from 'zod';
import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { STORAGE_PATH } from '../../config/index.js';
import { executeWorkflowStep } from './workflowStepExecutor.js';
import type { WorkflowTemplate } from './workflowTemplateService.js';
import type { WorkflowLifecycle } from './workflowLifecycle.js';

const sharedStateSchema = z.object({
  taskTitle: z.string(),
  taskDescription: z.string(),
  worktreePath: z.string(),
});

const stepOutputSchema = z.object({ summary: z.string() });

const firstStepInputSchema = z.object({
  taskId: z.number(),
  taskTitle: z.string(),
  taskDescription: z.string(),
  worktreePath: z.string(),
});

let _mastra: Mastra | null = null;
let _initialized = false;

export async function initWorkflows() {
  if (_initialized) return;
  const dbPath = path.join(STORAGE_PATH as string, 'mastra.db');
  _mastra = new Mastra({
    storage: new LibSQLStore({ id: 'kanban-workflow-store', url: `file:${dbPath}` }),
  });
  _initialized = true;
}

export function getMastra() {
  if (!_mastra) throw new Error('Mastra not initialized. Call initWorkflows() first.');
  return _mastra;
}

interface BuildWorkflowOptions {
  runId: number;
  task: { id: number; project_id: number; execution_path: string };
  lifecycle: WorkflowLifecycle;
}

export function getWorkflowFromWorkflowId(
    workflowId: string
){
   return getMastra().getWorkflow(workflowId);
}

export function buildWorkflowFromTemplate(
  workflowTemplate: WorkflowTemplate,
  options: BuildWorkflowOptions,
) {
  const steps = workflowTemplate.steps.map((templateStep, index) => {
    const isFirst = index === 0;
    const previousStepId = index > 0 ? workflowTemplate.steps[index - 1]?.id : null;

    return createStep({
      id: templateStep.id,
      inputSchema: isFirst ? firstStepInputSchema : stepOutputSchema,
      outputSchema: stepOutputSchema,
      stateSchema: sharedStateSchema,
      execute: async ({ inputData, state, abortSignal, abort }) => {
        let sessionId: number | undefined;
        let segmentId: number | undefined;
        const sessionInfo = await options.lifecycle.onStepStart(options.runId, templateStep.id, options.task);
        if(!sessionInfo){
            throw new Error("session created error")
        }

        sessionId = sessionInfo.sessionId;
        segmentId = sessionInfo.segmentId;

        const result = await executeWorkflowStep({
          stepId: templateStep.id,
          worktreePath: state.worktreePath,
          state,
          inputData,
          workflowTemplate: workflowTemplate,
          abortSignal,
          upstreamStepIds: previousStepId ? [previousStepId] : [],
          runId: options.runId,
          sessionId,
          segmentId,
          onProviderState: async (providerState) => {
            if (segmentId && options?.lifecycle.sessionSegmentRepo && providerState.providerSessionId) {
              await options.lifecycle.sessionSegmentRepo.update(segmentId, {
                provider_session_id: providerState.providerSessionId,
              });
            }
          },
        });

        if (abortSignal?.aborted) {
          abort();
          return { summary: '' };
        }

        return result;
      },
    });
  });

  let workflow = createWorkflow({
    id: workflowTemplate.template_id,
    inputSchema: firstStepInputSchema,
    outputSchema: stepOutputSchema,
    stateSchema: sharedStateSchema,
  });

  for (const step of steps) {
    workflow = workflow.then(step) as any;
  }

  workflow.commit();
  return workflow;
}

export { sharedStateSchema };
