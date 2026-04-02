export type AgentExecutorType = 'CLAUDE_CODE';

export interface CreateAgentBody {
  name: string;
  executorType: AgentExecutorType;
  role: string;
  description?: string;
  enabled: boolean;
  skills: number[];
  mcpServers: number[];
}

export interface UpdateAgentBody {
  name?: string;
  executorType?: AgentExecutorType;
  role?: string;
  description?: string;
  enabled?: boolean;
  skills?: number[];
  mcpServers?: number[];
}
