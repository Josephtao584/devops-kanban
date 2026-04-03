import {ExecutorType} from "../executors.js";

export interface CreateAgentBody {
  name: string;
  executorType: ExecutorType;
  role: string;
  description?: string;
  enabled: boolean;
  skills: number[];
  mcpServers: number[];
}

export interface UpdateAgentBody {
  name?: string;
  executorType?: ExecutorType;
  role?: string;
  description?: string;
  enabled?: boolean;
  skills?: number[];
  mcpServers?: number[];
}
