import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';

import { AgentChatRepository } from '../repositories/agentChatRepository.js';
import { AgentRepository } from '../repositories/agentRepository.js';
import { SkillRepository } from '../repositories/skillRepository.js';
import { McpServerRepository } from '../repositories/mcpServerRepository.js';
import { AgentExecutorRegistry } from './workflow/agentExecutorRegistry.js';
import { prepareExecutionSkills } from './workflow/executorSkillPreparation.js';
import { prepareExecutionMcp } from './workflow/executorMcpPreparation.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { WorkflowExecutionEvent } from '../types/executors.js';
import { ExecutorType } from '../types/executors.js';

type OnEventCallback = (event: WorkflowExecutionEvent & { isFinal?: boolean }) => void;

class AgentChatService {
  private chatRepo: AgentChatRepository;
  private agentRepo: AgentRepository;
  private skillRepo: SkillRepository;
  private mcpServerRepo: McpServerRepository;

  constructor() {
    this.chatRepo = new AgentChatRepository();
    this.agentRepo = new AgentRepository();
    this.skillRepo = new SkillRepository();
    this.mcpServerRepo = new McpServerRepository();
  }

  async startSession(agentId: number) {
    const agent = await this.agentRepo.findById(agentId);
    if (!agent) {
      throw new NotFoundError('未找到 Agent', `Agent not found: ${agentId}`);
    }

    const chatId = randomUUID();
    const tempDir = path.join(os.tmpdir(), `agent-chat-${chatId}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const session = this.chatRepo.createSession({
      id: chatId,
      agentId,
      status: 'idle',
      tempDir,
      providerSessionId: null,
    });

    logger.info('AgentChatService', `Started chat session ${chatId} for agent ${agentId}`);
    return session;
  }

  getSession(chatId: string) {
    return this.chatRepo.getSession(chatId);
  }

  getMessages(chatId: string) {
    return this.chatRepo.getMessages(chatId);
  }

  async sendMessage(chatId: string, userInput: string, onEvent: OnEventCallback): Promise<void> {
    const session = this.chatRepo.getSession(chatId);
    if (!session) {
      throw new NotFoundError('未找到对话会话', `Chat session not found: ${chatId}`);
    }

    if (session.status === 'ended') {
      throw new ValidationError('对话已结束', 'Chat session has ended');
    }

    if (session.status === 'running') {
      throw new ValidationError('Agent 正忙，请等待回复', 'Agent is currently processing a message');
    }

    const agent = await this.agentRepo.findById(session.agentId);
    if (!agent) {
      throw new NotFoundError('未找到 Agent', `Agent not found: ${session.agentId}`);
    }

    // Persist user message
    this.chatRepo.appendMessage(chatId, {
      kind: 'message',
      role: 'user',
      content: userInput,
      payload: {},
    });

    this.chatRepo.updateSession(chatId, { status: 'running' });

    try {
      // Prepare skills and MCP for temp dir
      await this._prepareWorktree(agent, session.tempDir);

      // Build executor config
      const executorConfig = {
        type: agent.executorType,
        env: agent.env,
        settingsPath: agent.settingsPath,
      };

      const registry = new AgentExecutorRegistry();
      const executor = registry.getExecutor(agent.executorType);

      const handleEvent = async (event: WorkflowExecutionEvent) => {
        // Persist assistant message events
        if (event.kind === 'message' || event.kind === 'tool_call' || event.kind === 'tool_result' ||
            event.kind === 'status' || event.kind === 'error' || event.kind === 'artifact' ||
            event.kind === 'stream_chunk' || event.kind === 'ask_user') {
          this.chatRepo.appendMessage(chatId, {
            kind: event.kind,
            role: event.role,
            content: event.content,
            payload: event.payload ?? {},
          });
        }
        onEvent(event);
      };

      // Use continue (with providerSessionId) for Claude Code multi-turn, execute for others
      let newProviderSessionId: string | null = null;
      const captureProviderState = async (state: { providerSessionId?: string | null }) => {
        if (state.providerSessionId) {
          newProviderSessionId = state.providerSessionId;
        }
      };

      if (agent.executorType === ExecutorType.CLAUDE_CODE && session.providerSessionId) {
        await executor.continue({
          prompt: userInput,
          worktreePath: session.tempDir,
          providerSessionId: session.providerSessionId,
          executorConfig,
          onEvent: handleEvent,
          onProviderState: captureProviderState,
        });
      } else {
        await executor.execute({
          prompt: userInput,
          worktreePath: session.tempDir,
          executorConfig,
          onEvent: handleEvent,
          onProviderState: captureProviderState,
        });
      }

      // Update provider session id for next turn
      if (newProviderSessionId) {
        this.chatRepo.updateSession(chatId, {
          status: 'idle',
          providerSessionId: newProviderSessionId,
        });
      } else {
        this.chatRepo.updateSession(chatId, { status: 'idle' });
      }
    } catch (err) {
      logger.error('AgentChatService', `sendMessage failed for session ${chatId}: ${err instanceof Error ? err.message : String(err)}`);
      this.chatRepo.updateSession(chatId, { status: 'idle' });
      // Propagate error event
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.chatRepo.appendMessage(chatId, {
        kind: 'error',
        role: 'system',
        content: errorMsg,
        payload: {},
      });
      onEvent({ kind: 'error', role: 'system', content: errorMsg, payload: {} });
      throw err;
    }
  }

  async deleteSession(chatId: string): Promise<void> {
    const session = this.chatRepo.getSession(chatId);
    if (!session) return;

    // Clean up temp dir
    try {
      if (fs.existsSync(session.tempDir)) {
        fs.rmSync(session.tempDir, { recursive: true, force: true });
      }
    } catch (err) {
      logger.warn('AgentChatService', `Failed to remove temp dir ${session.tempDir}: ${err instanceof Error ? err.message : String(err)}`);
    }

    this.chatRepo.deleteSession(chatId);
    logger.info('AgentChatService', `Deleted chat session ${chatId}`);
  }

  private async _prepareWorktree(agent: { executorType: ExecutorType; skills: number[]; mcpServers: number[] }, tempDir: string) {
    // Resolve skill names using a Map for O(1) lookups
    const allSkills = await this.skillRepo.findAll();
    const skillMap = new Map(allSkills.map(s => [s.id, s]));
    const skillNames = agent.skills
      .map(id => skillMap.get(id))
      .filter((s): s is NonNullable<typeof s> => s !== undefined)
      .map(s => s.identifier);

    await prepareExecutionSkills({
      executorType: agent.executorType,
      skillNames,
      executionPath: tempDir,
    });

    // Resolve MCP server configs using a Map for O(1) lookups
    const allServers = await this.mcpServerRepo.findAll();
    const serverMap = new Map(allServers.map(s => [s.id, s]));
    const mcpServerConfigs = agent.mcpServers
      .map(id => serverMap.get(id))
      .filter((s): s is NonNullable<typeof s> => s !== undefined)
      .map(s => ({
        name: s.name,
        server_type: s.server_type,
        config: s.config,
      }));

    await prepareExecutionMcp({
      executorType: agent.executorType,
      mcpServerConfigs,
      executionPath: tempDir,
    });
  }
}

export { AgentChatService };
