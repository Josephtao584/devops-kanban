export interface CreateAgentBody {
  name: string;
  type: string;
  role: string;
  description?: string;
  enabled: boolean;
  skills: string[];
}

export interface UpdateAgentBody {
  name?: string;
  type?: string;
  role?: string;
  description?: string;
  enabled?: boolean;
  skills?: string[];
}
