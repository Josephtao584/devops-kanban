export type SessionChannel = 'output' | 'status';

export interface SessionInputBody {
  input?: string;
}

export interface WebSocketPayload {
  type?: string;
  destination?: string;
  session_id?: number;
  channel?: SessionChannel;
  input?: string;
  body?: string | SessionInputBody;
}

export interface BroadcastPayload {
  type: string;
  content?: string;
  stream?: 'stdout' | 'stderr' | 'stdin';
  timestamp?: string;
  status?: string;
}

export type BroadcastFn = (sessionId: number, channel: SessionChannel, payload: BroadcastPayload) => void;
