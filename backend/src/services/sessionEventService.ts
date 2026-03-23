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

type AppendSessionEventInput = Omit<SessionEventEntity, 'id' | 'seq'> & { segment_id?: number };

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

    if (eventData.segment_id === undefined || eventData.segment_id === null) {
      throw createValidationError('segment_id is required');
    }

    const segment = await this.sessionSegmentRepo.findById(eventData.segment_id);
    if (!segment) {
      throw createValidationError('Segment not found');
    }
    if (segment.session_id !== eventData.session_id) {
      throw createValidationError('Segment must belong to the same session');
    }

    const seq = await this.sessionEventRepo.getNextSeq(eventData.session_id);
    return await this.sessionEventRepo.create({
      ...eventData,
      segment_id: eventData.segment_id,
      seq,
    });
  }

  async listEvents(sessionId: number, { afterSeq, limit }: { afterSeq?: number; limit?: number } = {}) {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      throw createNotFoundError('Session not found');
    }

    return await this.sessionEventRepo.listBySession(sessionId, { afterSeq, limit });
  }
}

export { SessionEventService };
export type { AppendSessionEventInput };
