import { SessionRepository } from '../repositories/sessionRepository.js';
import { SessionSegmentRepository } from '../repositories/sessionSegmentRepository.js';
import { SessionEventRepository } from '../repositories/sessionEventRepository.js';
import type { SessionEventEntity } from '../types/entities.ts';

function createValidationError(message: string) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function createNotFoundError(message: string) {
  return Object.assign(new Error(message), { statusCode: 404 });
}

type AppendSessionEventInput = Omit<SessionEventEntity, 'id' | 'seq'>;

type ListSessionEventsOptions = {
  afterSeq?: number;
  limit?: number;
};

class SessionEventService {
  sessionRepo: SessionRepository;
  sessionSegmentRepo: SessionSegmentRepository;
  sessionEventRepo: SessionEventRepository;

  constructor({
    sessionRepo,
    sessionSegmentRepo,
    sessionEventRepo,
  }: {
    sessionRepo?: SessionRepository;
    sessionSegmentRepo?: SessionSegmentRepository;
    sessionEventRepo?: SessionEventRepository;
  } = {}) {
    this.sessionRepo = sessionRepo || new SessionRepository();
    this.sessionSegmentRepo = sessionSegmentRepo || new SessionSegmentRepository();
    this.sessionEventRepo = sessionEventRepo || new SessionEventRepository();
  }

  async appendEvent(eventData: AppendSessionEventInput) {
    const session = await this.sessionRepo.findById(eventData.session_id);
    if (!session) {
      throw createNotFoundError('Session not found');
    }

    const segment = await this.sessionSegmentRepo.findById(eventData.segment_id);
    if (!segment) {
      throw createValidationError('Segment not found');
    }
    if (segment.session_id !== eventData.session_id) {
      throw createValidationError('Segment must belong to the same session');
    }

    return await this.sessionEventRepo.append(eventData);
  }

  async listEvents(sessionId: number, options: ListSessionEventsOptions = {}) {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      throw createNotFoundError('Session not found');
    }

    const repositoryOptions: ListSessionEventsOptions = {};
    if (options.afterSeq !== undefined) {
      repositoryOptions.afterSeq = options.afterSeq;
    }
    if (options.limit !== undefined) {
      repositoryOptions.limit = options.limit;
    }

    return await this.sessionEventRepo.listBySessionId(sessionId, repositoryOptions);
  }
}

export { SessionEventService };
export type { AppendSessionEventInput };
