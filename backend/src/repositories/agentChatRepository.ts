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

  private static _isValidChatId(id: string): boolean {
    return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  }

  getSession(chatId: string): AgentChatSession | null {
    if (!AgentChatRepository._isValidChatId(chatId)) return null;
    const data = this._read();
    if (!Object.prototype.hasOwnProperty.call(data.sessions, chatId)) return null;
    return data.sessions[chatId] ?? null;
  }

  updateSession(chatId: string, update: { status?: 'idle' | 'running' | 'ended'; providerSessionId?: string | null }): AgentChatSession | null {
    if (!AgentChatRepository._isValidChatId(chatId)) return null;
    const data = this._read();
    if (!Object.prototype.hasOwnProperty.call(data.sessions, chatId)) return null;
    const existing = data.sessions[chatId];
    if (!existing) return null;
    const updated: AgentChatSession = {
      id: existing.id,
      agentId: existing.agentId,
      status: update.status !== undefined ? update.status : existing.status,
      tempDir: existing.tempDir,
      providerSessionId: 'providerSessionId' in update ? (update.providerSessionId ?? null) : existing.providerSessionId,
      messages: existing.messages,
      created_at: existing.created_at,
      updated_at: new Date().toISOString(),
    };
    data.sessions[chatId] = updated;
    this._write(data);
    return updated;
  }

  appendMessage(chatId: string, msg: Omit<AgentChatMessage, 'id' | 'created_at'>): AgentChatMessage | null {
    if (!AgentChatRepository._isValidChatId(chatId)) return null;
    const data = this._read();
    if (!Object.prototype.hasOwnProperty.call(data.sessions, chatId)) return null;
    const existing = data.sessions[chatId];
    if (!existing) return null;
    const message: AgentChatMessage = {
      ...msg,
      id: existing.messages.length + 1,
      created_at: new Date().toISOString(),
    };
    data.sessions[chatId] = {
      ...existing,
      messages: [...existing.messages, message],
      updated_at: message.created_at,
    };
    this._write(data);
    return message;
  }

  getMessages(chatId: string): AgentChatMessage[] {
    const session = this.getSession(chatId);
    return session ? session.messages : [];
  }

  getSessionsByAgentId(agentId: number): AgentChatSession[] {
    const data = this._read();
    return Object.values(data.sessions)
      .filter(s => s.agentId === agentId && s.status !== 'ended')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  deleteSession(chatId: string): boolean {
    if (!AgentChatRepository._isValidChatId(chatId)) return false;
    const data = this._read();
    if (!Object.prototype.hasOwnProperty.call(data.sessions, chatId)) return false;
    delete data.sessions[chatId];
    this._write(data);
    return true;
  }
}

export { AgentChatRepository };
