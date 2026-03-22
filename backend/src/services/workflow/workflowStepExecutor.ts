import { AgentExecutorRegistry } from './agentExecutorRegistry.js';
import { adaptStepResult } from './stepResultAdapter.js';
import { WorkflowTemplateService } from './workflowTemplateService.js';
import { assembleWorkflowPrompt } from './workflowPromptAssembler.js';
import type { ExecutorConfig, ExecutorExecutionResult, ExecutorProcessHandle, ExecutorType } from '../../types/executors.js';

const defaultRegistry = new AgentExecutorRegistry();
const defaultTemplateService = new WorkflowTemplateService();

interface ExecuteWorkflowStepInput {
  registry?: AgentExecutorRegistry;
  templateService?: WorkflowTemplateService;
  context?: { proc?: ExecutorProcessHandle | null } | undefined;
  stepId: string;
  worktreePath: string;
  state: {
    taskTitle: string;
    taskDescription: string;
    worktreePath: string;
  };
  inputData: Record<string, unknown>;
  upstreamStepIds?: string[];
}

export async function executeWorkflowStep({
  registry = defaultRegistry,
  templateService = defaultTemplateService,
  context,
  stepId,
  worktreePath,
  state,
  inputData,
  upstreamStepIds = [],
}: ExecuteWorkflowStepInput) {
  const template = await templateService.getTemplate();
  const step = template.steps.find((item: { id: string }) => item.id === stepId);

  if (!step) {
    throw new Error(`Workflow template step not found: ${stepId}`);
  }

  const prompt = assembleWorkflowPrompt({
    step,
    state,
    inputData,
    upstreamStepIds,
  });

  const executor = registry.getExecutor(step.executor.type as ExecutorType);
  const execution: ExecutorExecutionResult = await executor.execute({
    prompt,
    worktreePath,
    executorConfig: step.executor as ExecutorConfig,
    onSpawn: (proc) => {
      if (context) {
        context.proc = proc as ExecutorProcessHandle;
      }
    },
  });

  if (context) {
    context.proc = execution.proc;
  }

  return adaptStepResult(step.executor.type, execution);
}
