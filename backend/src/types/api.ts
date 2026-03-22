export interface ApiSuccessResponse<T> {
  success: true;
  message: string;
  data: T;
  error: null;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  data: null;
  error: unknown;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface RootRouteResponse {
  success: true;
  message: string;
  version: string;
  data: {
    endpoints: Record<string, string>;
  };
}

export interface HealthRouteResponse {
  status: 'ok';
}

export interface SessionOutputChunkMessage {
  sessionId: number;
  channel: 'output' | 'status';
  type: 'chunk';
  content: string;
  stream: 'stdout' | 'stderr' | 'stdin';
  timestamp: string;
}

export interface SessionSubscribedMessage {
  type: 'SUBSCRIBED' | 'subscribed';
  destination?: string;
  session_id?: number;
  channel?: 'output' | 'status';
}

export type SessionWebSocketServerMessage = SessionOutputChunkMessage | SessionSubscribedMessage;
