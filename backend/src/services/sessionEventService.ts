import { SessionRepository } from '../repositories/sessionRepository.js';
import { SessionSegmentRepository } from '../repositories/sessionSegmentRepository.js';
import { SessionEventRepository } from '../repositories/sessionEventRepository.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import type { SessionEventEntity } from '../types/entities.ts';

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
      throw new NotFoundError('未找到会话', 'Session not found', { sessionId: eventData.session_id });
    }

    const segment = await this.sessionSegmentRepo.findById(eventData.segment_id);
    if (!segment) {
      throw new ValidationError('未找到片段', 'Segment not found', { segmentId: eventData.segment_id });
    }
    if (segment.session_id !== eventData.session_id) {
      throw new ValidationError('片段必须属于同一会话', 'Segment must belong to the same session', { segmentId: eventData.segment_id, sessionId: eventData.session_id });
    }

    return await this.sessionEventRepo.append(eventData);
  }

  async listEvents(sessionId: number, options: ListSessionEventsOptions = {}) {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      throw new NotFoundError('未找到会话', 'Session not found', { sessionId });
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
