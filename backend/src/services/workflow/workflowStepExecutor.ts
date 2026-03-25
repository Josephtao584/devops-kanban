import { AgentRepository } from '../../repositories/agentRepository.js';
import type { AgentEntity } from '../../repositories/agentRepository.js';
import type {
  ExecutorConfig,
  ExecutorExecutionResult,
  ExecutorProcessHandle,
  ExecutorProviderState,
  ExecutorType,
  WorkflowExecutionEvent,
} from '../../types/executors.js';
import type { WorkflowTemplateEntity } from '../../types/entities.ts';
import { AgentExecutorRegistry } from './agentExecutorRegistry.js';
import { ExecutionEventSink } from './executionEventSink.js';
import { adaptStepResult } from './stepResultAdapter.js';
import { WorkflowTemplateService } from './workflowTemplateService.js';
import { assembleWorkflowPrompt } from './workflowPromptAssembler.js';

const defaultRegistry = new AgentExecutorRegistry();
const defaultTemplateService = new WorkflowTemplateService();
const defaultAgentRepo = new AgentRepository();

interface ExecuteWorkflowStepInput {
  registry?: AgentExecutorRegistry;
  templateSnapshot?: WorkflowTemplateEntity;
  templateService?: WorkflowTemplateService;
  agentRepo?: AgentRepository;
  context?: { proc?: ExecutorProcessHandle | null } | undefined;
  onEvent?: ((event: WorkflowExecutionEvent) => void | Promise<void>) | undefined;
  onProviderState?: ((providerState: ExecutorProviderState) => void | Promise<void>) | undefined;
  stepId: string;
  worktreePath: string;
  state: {
    taskTitle: string;
    taskDescription: string;
    worktreePath: string;
  };
  inputData: Record<string, unknown>;
  upstreamStepIds?: string[];
  abortSignal?: AbortSignal | undefined;
  runId?: number;
  sessionId?: number | null;
  segmentId?: number | null;
}

function isExecutorType(value: unknown): value is ExecutorType {
  return value === 'CLAUDE_CODE' || value === 'CODEX' || value === 'OPENCODE';
}

function buildExecutorConfig(agent: AgentEntity): ExecutorConfig {
  if (!isExecutorType(agent.executorType)) {
    throw new Error(`Agent ${agent.id} has unsupported executor type: ${String(agent.executorType)}`);
  }

  if (!Array.isArray(agent.skills) || agent.skills.some((skill) => typeof skill !== 'string')) {
    throw new Error(`Agent ${agent.id} has invalid skills configuration`);
  }

  return {
    type: agent.executorType,
    skills: [...agent.skills],
  };
}

export async function executeWorkflowStep({
  registry = defaultRegistry,
  templateSnapshot,
  templateService = defaultTemplateService,
  agentRepo = defaultAgentRepo,
  context,
  onEvent,
  onProviderState,
  abortSignal,
  stepId,
  worktreePath,
  state,
  inputData,
  upstreamStepIds = [],
}: ExecuteWorkflowStepInput) {
  const template = templateSnapshot ?? await templateService.getTemplate();
  const step = template.steps.find((item: { id: string }) => item.id === stepId);

  if (!step) {
    throw new Error(`Workflow template step not found: ${stepId}`);
  }

  if (typeof step.agentId !== 'number') {
    throw new Error(`Workflow template step ${stepId} does not have a bound agent`);
  }

  const agent = await agentRepo.findById(step.agentId);
  if (!agent) {
    throw new Error(`Workflow step ${stepId} references missing agent ${step.agentId}`);
  }

  if (!agent.enabled) {
    throw new Error(`Workflow step ${stepId} bound agent ${step.agentId} is disabled`);
  }

  const executorConfig = buildExecutorConfig(agent);
  const prompt = assembleWorkflowPrompt({
    step,
    state,
    inputData,
    upstreamStepIds,
  });
  const sink = new ExecutionEventSink({ onEvent, onProviderState });

  if (abortSignal && context) {
    abortSignal.addEventListener('abort', () => {
      context?.proc?.kill?.('SIGTERM');
    }, { once: true });
  }

  const executor = registry.getExecutor(executorConfig.type);
  const execution: ExecutorExecutionResult = await executor.execute({
    prompt,
    worktreePath,
    executorConfig,
    abortSignal,
    onSpawn: (proc) => {
      if (context) {
        context.proc = proc;
      }
    },
    onEvent: async (event) => {
      await sink.append(event);
    },
    onProviderState: async (providerState) => {
      await sink.appendProviderState(providerState);
    },
  });

  if (context) {
    context.proc = execution.proc;
  }

  return adaptStepResult(executorConfig.type, execution);
}
