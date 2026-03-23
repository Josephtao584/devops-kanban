import type { SessionEventEntity } from '../entities.ts';

export interface ListSessionEventsQuery {
  segment_id?: string;
  limit?: string;
  after?: string;
}

export type SessionEventListItem = SessionEventEntity;
