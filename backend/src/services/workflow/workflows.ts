import * as path from 'node:path';
import { z } from 'zod';
import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { STORAGE_PATH } from '../../config/index.js';
import { executeWorkflowStep } from './workflowStepExecutor.js';
import type { WorkflowTemplateEntity } from '../../types/entities.js';
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

// Suspend/resume schemas for confirmation steps
const resumeSchema = z.object({
  approved: z.boolean(),
  comment: z.string().optional(),
});

const suspendSchema = z.object({
  reason: z.string(),
  stepName: z.string(),
  summary: z.string().optional(),
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

export function getWorkflowFromWorkflowId(workflowId: string) {
  try {
    return getMastra().getWorkflow(workflowId);
  } catch {
    return null;
  }
}

/**
 * Check if a workflow is registered with Mastra
 */
export function hasWorkflow(workflowId: string): boolean {
  try {
    getMastra().getWorkflow(workflowId);
    return true;
  } catch {
    return false;
  }
}

export function buildWorkflowFromTemplate(
  workflowTemplate: WorkflowTemplateEntity,
  options: BuildWorkflowOptions,
) {

  const steps = workflowTemplate.steps.map((templateStep, index) => {
    const isFirst = index === 0;
    const previousStepId = index > 0 ? workflowTemplate.steps[index - 1]?.id : null;
    const requiresConfirmation = templateStep.requiresConfirmation ?? false;

    return createStep({
      id: templateStep.id,
      inputSchema: isFirst ? firstStepInputSchema : stepOutputSchema,
      outputSchema: stepOutputSchema,
      stateSchema: sharedStateSchema,
      // Add resume/suspend schemas for confirmation steps
      resumeSchema: requiresConfirmation ? resumeSchema : undefined,
      suspendSchema: requiresConfirmation ? suspendSchema : undefined,
      execute: async ({ inputData, state, abortSignal, abort, resumeData, suspend, suspendData }) => {
        console.log(`[Workflow] Step ${templateStep.id} starting, abortSignal exists: ${!!abortSignal}, workflowRun: ${options.runId}, resumeData: ${!!resumeData}`);

        if (abortSignal) {
          abortSignal.addEventListener('abort', () => {
            console.log(`[Workflow] Step ${templateStep.id} received abort signal! workflowRun: ${options.runId}`);
          });
        }

        // Type the resume data and suspend data
        const typedResumeData = resumeData as { approved?: boolean; comment?: string } | undefined;
        const typedSuspendData = suspendData as { reason?: string; stepName?: string; summary?: string } | undefined;

        // === Resume execution (user confirmed) ===
        if (requiresConfirmation && typedResumeData?.approved) {
          // Get previous result from suspendData, don't re-execute
          const previousSummary = typedSuspendData?.summary || '';
          console.log(`[Workflow] Step ${templateStep.id} resuming with approved=true, using suspendData.summary`);

          const resumePayload: { approved: boolean; comment?: string } = { approved: true };
          if (typedResumeData.comment !== undefined) {
            resumePayload.comment = typedResumeData.comment;
          }
          await options.lifecycle.onStepResume(options.runId, templateStep.id, resumePayload);
          await options.lifecycle.onStepComplete(options.runId, templateStep.id, { summary: previousSummary });

          return { summary: previousSummary };
        }

        // === First execution ===
        let sessionId: number | undefined;
        let segmentId: number | undefined;
        const sessionInfo = await options.lifecycle.onStepStart(options.runId, templateStep.id, options.task);
        if (!sessionInfo) {
          console.log(`[Workflow] Step ${templateStep.id} start was skipped or cancelled for workflowRun: ${options.runId}`);
          return { summary: '' };
        }

        sessionId = sessionInfo.sessionId;
        segmentId = sessionInfo.segmentId;

        try {
          const result = await executeWorkflowStep({
            stepId: templateStep.id,
            worktreePath: state.worktreePath,
            state,
            inputData,
            workflowTemplate,
            abortSignal,
            upstreamStepIds: previousStepId ? [previousStepId] : [],
            onEvent: async (event) => {
              await options?.lifecycle.sessionEventRepo.append({
                session_id: sessionId,
                segment_id: segmentId,
                kind: event.kind,
                role: event.role,
                content: event.content,
                payload: event.payload || {},
              });
            },
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

          // Check if confirmation is required
          if (requiresConfirmation && !typedResumeData?.approved) {
            const suspendReason = `请确认步骤 "${templateStep.name}" 是否完成`;

            await options.lifecycle.onStepSuspend(options.runId, templateStep.id, {
              reason: suspendReason,
              summary: result.summary,
            });

            // Call Mastra suspend with result stored in suspendData
            return await suspend({
              reason: suspendReason,
              stepName: templateStep.name,
              summary: result.summary,
            });
          }

          // Step completed successfully (no confirmation required)
          await options.lifecycle.onStepComplete(options.runId, templateStep.id, result);

          return result;
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          await options.lifecycle.onStepError(options.runId, templateStep.id, errorMessage);
          throw err;
        }
      },
    });
  });

  let workflow = createWorkflow({
    id: workflowTemplate.template_id,
    inputSchema: firstStepInputSchema,
    outputSchema: stepOutputSchema,
    stateSchema: sharedStateSchema,
    options: {
      onFinish: async (result) => {
        if (result.status === 'success') {
          await options.lifecycle.onWorkflowComplete(options.runId, result.result ?? {});
        } else if (result.status === 'suspended') {
          // Workflow suspended - lifecycle already handled in onStepSuspend
          const suspendedSteps = (result as any).suspended as string[] | undefined;
          console.log(`[Workflow] Workflow suspended at steps: ${suspendedSteps?.join(', ')}`);
        } else if (result.status === 'failed' || result.status === 'tripwire') {
          const errorMessage = result.error?.message || 'Workflow failed';
          await options.lifecycle.onWorkflowError(options.runId, errorMessage);
        }
      },
      onError: async (errorInfo) => {
        const errorMessage = errorInfo.error?.message || 'Workflow failed';
        await options.lifecycle.onWorkflowError(options.runId, errorMessage);
      },
    },
  });

  for (const step of steps) {
    workflow = workflow.then(step) as any;
  }

  workflow.commit();

  // Register workflow with Mastra for persistence and retrieval
  getMastra().addWorkflow(workflow);

  return workflow;
}

export { sharedStateSchema };