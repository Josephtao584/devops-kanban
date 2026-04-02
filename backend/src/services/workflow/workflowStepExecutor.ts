import { AgentRepository } from '../../repositories/agentRepository.js';
import type {
  ExecutorConfig,
  ExecutorExecutionResult,
  ExecutorProviderState,
  ExecutorType,
  WorkflowExecutionEvent,
} from '../../types/executors.js';
import type { AgentEntity, WorkflowInstanceEntity } from '../../types/entities.ts';
import { AgentExecutorRegistry } from './agentExecutorRegistry.js';
import { adaptStepResult } from './stepResultAdapter.js';
import { assembleWorkflowPrompt } from './workflowPromptAssembler.js';

const defaultRegistry = new AgentExecutorRegistry();
const defaultAgentRepo = new AgentRepository();

interface ExecuteWorkflowStepInput {
  registry?: AgentExecutorRegistry;
  workflowInstance: WorkflowInstanceEntity;
  agentRepo?: AgentRepository;
  stepId: string;
  worktreePath: string;
  state: {
    taskTitle: string;
    taskDescription: string;
    worktreePath: string;
  };
  inputData: Record<string, unknown>;
  upstreamStepIds?: string[];
  abortSignal?: AbortSignal;
  onEvent?: (event: WorkflowExecutionEvent) => void | Promise<void>;
  onProviderState?: (providerState: ExecutorProviderState) => void | Promise<void>;
}

function isExecutorType(value: unknown): value is ExecutorType {
  return value === 'CLAUDE_CODE';
}

function buildExecutorConfig(agent: AgentEntity): ExecutorConfig {
  if (!isExecutorType(agent.executorType)) {
    throw new Error(`Agent ${agent.id} has unsupported executor type: ${String(agent.executorType)}`);
  }

  if (!Array.isArray(agent.skills) || agent.skills.some((skill) => typeof skill !== 'number')) {
    throw new Error(`Agent ${agent.id} has invalid skills configuration`);
  }

  return {
    type: agent.executorType,
    skills: [...agent.skills],
  };
}

async function resolveAgent(agentRepo: AgentRepository, stepId: string, agentId: number): Promise<AgentEntity> {
  const agent = await agentRepo.findById(agentId);
  if (!agent) {
    throw new Error(`Workflow step ${stepId} references missing agent ${agentId}`);
  }
  if (!agent.enabled) {
    throw new Error(`Workflow step ${stepId} bound agent ${agentId} is disabled`);
  }
  return agent;
}

export async function executeWorkflowStep({
  registry = defaultRegistry,
  workflowInstance,
  agentRepo = defaultAgentRepo,
  stepId,
  worktreePath,
  state,
  inputData,
  upstreamStepIds = [],
  abortSignal,
  onEvent,
  onProviderState,
}: ExecuteWorkflowStepInput) {
  // 1. Find step
  const step = workflowInstance.steps.find((item) => item.id === stepId);
  if (!step) {
    throw new Error(`Workflow instance step not found: ${stepId}`);
  }

  // 2. Resolve agent
  const agent = await resolveAgent(agentRepo, stepId, step.agentId);
  const executorConfig = buildExecutorConfig(agent);

  // 3. Build prompt
  const prompt = assembleWorkflowPrompt({ step, state, inputData, upstreamStepIds, agent });

  // 4. Execute
  const executor = registry.getExecutor(executorConfig.type);
  const execution: ExecutorExecutionResult = await executor.execute({
    prompt,
    worktreePath,
    executorConfig,
    abortSignal,
    onEvent,
    onProviderState,
  });

  return adaptStepResult(executorConfig.type, execution);
}
