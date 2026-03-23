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
  templateService?: WorkflowTemplateService;
  agentRepo?: Pick<AgentRepository, 'findById'>;
  context?: { proc?: ExecutorProcessHandle | null } | undefined;
  onEvent?: ((event: WorkflowExecutionEvent) => void) | undefined;
  onProviderState?: ((providerState: ExecutorProviderState) => void) | undefined;
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

function isExecutorType(value: unknown): value is ExecutorType {
  return value === 'CLAUDE_CODE' || value === 'CODEX' || value === 'OPENCODE';
}

function buildExecutorConfig(agent: AgentEntity): ExecutorConfig {
  if (!isExecutorType(agent.executorType)) {
    throw new Error(`Agent ${agent.id} has unsupported executor type: ${String(agent.executorType)}`);
  }

  if (agent.commandOverride != null && (typeof agent.commandOverride !== 'string' || agent.commandOverride.trim().length === 0)) {
    throw new Error(`Agent ${agent.id} has invalid command override`);
  }

  if (!Array.isArray(agent.args) || agent.args.some((arg) => typeof arg !== 'string')) {
    throw new Error(`Agent ${agent.id} has invalid args configuration`);
  }

  if (agent.env == null || typeof agent.env !== 'object' || Array.isArray(agent.env) || Object.values(agent.env).some((value) => typeof value !== 'string')) {
    throw new Error(`Agent ${agent.id} has invalid env configuration`);
  }

  if (!Array.isArray(agent.skills) || agent.skills.some((skill) => typeof skill !== 'string')) {
    throw new Error(`Agent ${agent.id} has invalid skills configuration`);
  }

  return {
    type: agent.executorType,
    commandOverride: agent.commandOverride ?? null,
    args: [...agent.args],
    env: { ...agent.env },
    skills: [...agent.skills],
  };
}

export async function executeWorkflowStep({
  registry = defaultRegistry,
  templateService = defaultTemplateService,
  agentRepo = defaultAgentRepo,
  context,
  onEvent,
  onProviderState,
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

  const executor = registry.getExecutor(executorConfig.type);
  const execution: ExecutorExecutionResult = await executor.execute({
    prompt,
    worktreePath,
    executorConfig,
    onSpawn: (proc) => {
      if (context) {
        context.proc = proc;
      }
    },
    onEvent: (event) => {
      sink.emit(event);
    },
    onProviderState: (providerState) => {
      sink.providerState(providerState);
    },
  });

  if (context) {
    context.proc = execution.proc;
  }

  return adaptStepResult(executorConfig.type, execution);
}
