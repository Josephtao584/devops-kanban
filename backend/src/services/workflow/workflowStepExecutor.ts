import { AgentRepository } from '../../repositories/agentRepository.js';
import type {
  AskUserQuestionData,
  ExecutorConfig,
  ExecutorExecutionResult,
  ExecutorProviderState,
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
    projectEnv?: Record<string, string>;
  };
  inputData: Record<string, unknown>;
  upstreamStepIds?: string[];
  projectEnv?: Record<string, string>;
  abortSignal?: AbortSignal;
  onEvent?: (event: WorkflowExecutionEvent) => void | Promise<void>;
  onProviderState?: (providerState: ExecutorProviderState) => void | Promise<void>;
  onAskUser?: (data: AskUserQuestionData) => void | Promise<void>;
}

function buildExecutorConfig(agent: AgentEntity): ExecutorConfig {
  if (!Array.isArray(agent.skills) || agent.skills.some((skill) => typeof skill !== 'number')) {
    throw new Error(`Agent ${agent.id} has invalid skills configuration`);
  }

  if (!Array.isArray(agent.mcpServers) || agent.mcpServers.some((id) => typeof id !== 'number')) {
    throw new Error(`Agent ${agent.id} has invalid MCP servers configuration`);
  }

  return {
    type: agent.executorType,
    skills: [...agent.skills],
    mcpServers: [...agent.mcpServers],
    env: agent.env ? { ...agent.env } : undefined,
    settingsPath: agent.settingsPath || undefined,
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
  projectEnv,
  abortSignal,
  onEvent,
  onProviderState,
  onAskUser,
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
  const effectiveProjectEnv = projectEnv ?? state.projectEnv;
  const prompt = assembleWorkflowPrompt({
    step,
    state,
    inputData,
    upstreamStepIds,
    agent,
    ...(effectiveProjectEnv ? { projectEnv: effectiveProjectEnv } : {}),
  });

  // 4. Execute
  const executor = registry.getExecutor(executorConfig.type);
  const execution: ExecutorExecutionResult = await executor.execute({
    prompt,
    worktreePath,
    executorConfig,
    abortSignal,
    onEvent,
    onProviderState,
    onAskUser,
  });

  return adaptStepResult(executorConfig.type, execution);
}

export async function continueWorkflowStepWithAnswer({
  registry = defaultRegistry,
  workflowInstance,
  agentRepo = defaultAgentRepo,
  stepId,
  worktreePath,
  providerSessionId,
  answerPrompt,
  onEvent,
  onProviderState,
  onAskUser,
}: {
  registry?: AgentExecutorRegistry;
  workflowInstance: WorkflowInstanceEntity;
  agentRepo?: AgentRepository;
  stepId: string;
  worktreePath: string;
  providerSessionId: string;
  answerPrompt: string;
  onEvent?: (event: WorkflowExecutionEvent) => void | Promise<void>;
  onProviderState?: (providerState: ExecutorProviderState) => void | Promise<void>;
  onAskUser?: (data: AskUserQuestionData) => void | Promise<void>;
}) {
  const step = workflowInstance.steps.find((item) => item.id === stepId);
  if (!step) throw new Error(`Workflow instance step not found: ${stepId}`);

  const agent = await resolveAgent(agentRepo, stepId, step.agentId);
  const executorConfig = buildExecutorConfig(agent);
  const executor = registry.getExecutor(executorConfig.type);

  const execution = await executor.continue({
    prompt: answerPrompt,
    worktreePath,
    providerSessionId,
    executorConfig,
    ...(onEvent ? { onEvent } : {}),
    ...(onProviderState ? { onProviderState } : {}),
    ...(onAskUser ? { onAskUser } : {}),
  });

  return adaptStepResult(executorConfig.type, execution);
}
