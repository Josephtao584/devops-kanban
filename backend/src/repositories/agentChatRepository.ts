import * as fs from 'node:fs';
import * as path from 'node:path';
import { STORAGE_PATH } from '../config/index.js';

export type AgentChatMessageKind = 'message' | 'tool_call' | 'tool_result' | 'status' | 'error' | 'artifact' | 'stream_chunk' | 'ask_user';
export type AgentChatMessageRole = 'assistant' | 'system' | 'tool' | 'user';

export interface AgentChatMessage {
  id: number;
  kind: AgentChatMessageKind;
  role: AgentChatMessageRole;
  content: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface AgentChatSession {
  id: string;
  agentId: number;
  status: 'idle' | 'running' | 'ended';
  tempDir: string;
  providerSessionId: string | null;
  messages: AgentChatMessage[];
  created_at: string;
  updated_at: string;
}

type StorageData = {
  sessions: Record<string, AgentChatSession>;
};

class AgentChatRepository {
  private filePath: string;

  constructor() {
    this.filePath = path.join(STORAGE_PATH, 'agent_chats.json');
  }

  private _read(): StorageData {
    if (!fs.existsSync(this.filePath)) {
      return { sessions: {} };
    }
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(raw) as StorageData;
    } catch {
      return { sessions: {} };
    }
  }

  private _write(data: StorageData): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  createSession(session: Omit<AgentChatSession, 'messages' | 'created_at' | 'updated_at'>): AgentChatSession {
    const data = this._read();
    const now = new Date().toISOString();
    const fullSession: AgentChatSession = {
      ...session,
      messages: [],
      created_at: now,
      updated_at: now,
    };
    data.sessions[session.id] = fullSession;
    this._write(data);
    return fullSession;
  }

  getSession(chatId: string): AgentChatSession | null {
    if (!chatId || !Object.prototype.hasOwnProperty.call(this._read().sessions, chatId)) return null;
    return this._read().sessions[chatId] ?? null;
  }

  updateSession(chatId: string, update: { status?: 'idle' | 'running' | 'ended'; providerSessionId?: string | null }): AgentChatSession | null {
    if (!chatId) return null;
    const data = this._read();
    if (!Object.prototype.hasOwnProperty.call(data.sessions, chatId)) return null;
    const session = data.sessions[chatId];
    if (update.status !== undefined) {
      session.status = update.status;
    }
    if ('providerSessionId' in update) {
      session.providerSessionId = update.providerSessionId ?? null;
    }
    session.updated_at = new Date().toISOString();
    this._write(data);
    return session;
  }

  appendMessage(chatId: string, msg: Omit<AgentChatMessage, 'id' | 'created_at'>): AgentChatMessage | null {
    if (!chatId) return null;
    const data = this._read();
    if (!Object.prototype.hasOwnProperty.call(data.sessions, chatId)) return null;
    const session = data.sessions[chatId];
    const message: AgentChatMessage = {
      ...msg,
      id: session.messages.length + 1,
      created_at: new Date().toISOString(),
    };
    session.messages.push(message);
    session.updated_at = message.created_at;
    this._write(data);
    return message;
  }

  getMessages(chatId: string): AgentChatMessage[] {
    const session = this.getSession(chatId);
    return session ? session.messages : [];
  }

  deleteSession(chatId: string): boolean {
    if (!chatId) return false;
    const data = this._read();
    if (!Object.prototype.hasOwnProperty.call(data.sessions, chatId)) return false;
    delete data.sessions[chatId];
    this._write(data);
    return true;
  }
}

export { AgentChatRepository };
