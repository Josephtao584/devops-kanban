import { AgentExecutorRegistry } from './agentExecutorRegistry.js';
import { adaptStepResult } from './stepResultAdapter.js';
import { WorkflowTemplateService } from './workflowTemplateService.js';

const defaultRegistry = new AgentExecutorRegistry();
const defaultTemplateService = new WorkflowTemplateService();

export async function executeWorkflowStep({
  registry = defaultRegistry,
  templateService = defaultTemplateService,
  context,
  stepId,
  worktreePath,
  taskTitle,
  taskDescription,
  previousSummary = '',
}) {
  const template = await templateService.getTemplate();
  const step = template.steps.find((item) => item.id === stepId);

  if (!step) {
    throw new Error(`Workflow template step not found: ${stepId}`);
  }

  const executor = registry.getExecutor(step.executor.type);
  const execution = await executor.execute({
    stepId,
    worktreePath,
    taskTitle,
    taskDescription,
    previousSummary,
    executorConfig: step.executor,
    onSpawn: (proc) => {
      if (context) {
        context.proc = proc;
      }
    },
  });

  if (context && execution?.proc) {
    context.proc = execution.proc;
  }

  return adaptStepResult(step.executor.type, execution);
}
