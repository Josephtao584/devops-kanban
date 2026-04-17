import {ExecutorType} from "../executors.js";

export interface CreateAgentBody {
  /** @maxLength 200 */
  name: string;
  executorType: ExecutorType;
  /** @maxLength 200 */
  role: string;
  /** @maxLength 5000 */
  description?: string;
  enabled: boolean;
  skills: number[];
  mcpServers: number[];
}

export interface UpdateAgentBody {
  /** @maxLength 200 */
  name?: string;
  executorType?: ExecutorType;
  /** @maxLength 200 */
  role?: string;
  /** @maxLength 5000 */
  description?: string;
  enabled?: boolean;
  skills?: number[];
  mcpServers?: number[];
}
