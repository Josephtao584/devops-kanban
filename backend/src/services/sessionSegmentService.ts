import { SessionRepository } from '../repositories/sessionRepository.js';
import { SessionSegmentRepository } from '../repositories/sessionSegmentRepository.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import type { SessionSegmentEntity } from '../types/entities.ts';

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
      throw new NotFoundError('未找到会话', 'Session not found', { sessionId: segmentData.session_id });
    }

    if (segmentData.parent_segment_id !== null && segmentData.parent_segment_id !== undefined) {
      const parentSegment = await this.sessionSegmentRepo.findById(segmentData.parent_segment_id);
      if (!parentSegment) {
        throw new ValidationError('未找到父片段', 'Parent segment not found', { parentSegmentId: segmentData.parent_segment_id });
      }
      if (parentSegment.session_id !== segmentData.session_id) {
        throw new ValidationError('父片段必须属于同一会话', 'Parent segment must belong to the same session', { parentSegmentId: segmentData.parent_segment_id, sessionId: segmentData.session_id });
      }
    }

    return await this.sessionSegmentRepo.create(segmentData);
  }
}

export { SessionSegmentService };
export type { CreateSegmentInput };
