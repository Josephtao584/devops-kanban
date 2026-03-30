export type AgentExecutorType = 'CLAUDE_CODE' | 'CODEX' | 'OPENCODE';

export interface CreateAgentBody {
  name: string;
  executorType: AgentExecutorType;
  role: string;
  description?: string;
  enabled: boolean;
  skills: number[];
}

export interface UpdateAgentBody {
  name?: string;
  executorType?: AgentExecutorType;
  role?: string;
  description?: string;
  enabled?: boolean;
  skills?: number[];
}
