export interface ListSessionEventsQuery {
  after_seq?: string;
  limit?: string;
}

export interface SessionEventListItem {
  id: number;
  session_id: number;
  segment_id: number;
  seq: number;
  kind: 'message' | 'tool_call' | 'tool_result' | 'status' | 'error' | 'artifact' | 'stream_chunk' | 'ask_user';
  role: 'assistant' | 'system' | 'tool' | 'user';
  content: string;
  payload: Record<string, unknown>;
  created_at: string;
}
