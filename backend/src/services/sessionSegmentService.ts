import { SessionRepository } from '../repositories/sessionRepository.js';
import { SessionSegmentRepository } from '../repositories/sessionSegmentRepository.js';
import type { SessionSegmentEntity } from '../types/entities.ts';

function createValidationError(message: string) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function createNotFoundError(message: string) {
  return Object.assign(new Error(message), { statusCode: 404 });
}

type CreateSegmentInput = Omit<SessionSegmentEntity, 'id' | 'segment_index'>;

class SessionSegmentService {
  sessionRepo: SessionRepository;
  sessionSegmentRepo: SessionSegmentRepository;

  constructor({
    sessionRepo,
    sessionSegmentRepo,
  }: {
    sessionRepo?: SessionRepository;
    sessionSegmentRepo?: SessionSegmentRepository;
  } = {}) {
    this.sessionRepo = sessionRepo || new SessionRepository();
    this.sessionSegmentRepo = sessionSegmentRepo || new SessionSegmentRepository();
  }

  async createSegment(segmentData: CreateSegmentInput) {
    const session = await this.sessionRepo.findById(segmentData.session_id);
    if (!session) {
      throw createNotFoundError('Session not found');
    }

    if (segmentData.parent_segment_id !== null && segmentData.parent_segment_id !== undefined) {
      const parentSegment = await this.sessionSegmentRepo.findById(segmentData.parent_segment_id);
      if (!parentSegment) {
        throw createValidationError('Parent segment not found');
      }
      if (parentSegment.session_id !== segmentData.session_id) {
        throw createValidationError('Parent segment must belong to the same session');
      }
    }

    const latestSegment = await this.sessionSegmentRepo.findLatestBySessionId(segmentData.session_id);
    const segment_index = latestSegment ? latestSegment.segment_index + 1 : 1;

    return await this.sessionSegmentRepo.create({
      ...segmentData,
      segment_index,
    });
  }
}

export { SessionSegmentService };
export type { CreateSegmentInput };
