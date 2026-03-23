import type { SessionEntity } from '../entities.ts';

export interface CreateSessionInput {
  task_id: number;
  initial_prompt?: string | null;
}

export interface ContinueSessionBody {
  input?: string;
}

export type SessionListItem = SessionEntity;
