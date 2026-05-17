import { describe, it, expect } from 'vitest'
import { canLoopAgain, canLoopBack } from '../src/utils/loopActionVisibility.js'

describe('canLoopAgain', () => {
  it('returns false when run is null', () => {
    expect(canLoopAgain(null)).toBe(false)
    expect(canLoopAgain(undefined)).toBe(false)
  })

  it('returns false when run is not FAILED', () => {
    const run = {
      status: 'COMPLETED',
      iteration: 5,
      workflow_template_snapshot: { maxLoops: 2 },
    }
    expect(canLoopAgain(run)).toBe(false)
  })

  // Regression: previously used iteration > maxLoops which left
  // iteration === maxLoops as an unreachable state — backend rejects the
  // next auto-loop (would be maxLoops+1) but the button stays hidden.
  it('renders when iteration equals maxLoops on a FAILED run', () => {
    const run = {
      status: 'FAILED',
      iteration: 2,
      workflow_template_snapshot: { maxLoops: 2 },
    }
    expect(canLoopAgain(run)).toBe(true)
  })

  it('renders when iteration exceeds maxLoops', () => {
    const run = {
      status: 'FAILED',
      iteration: 5,
      workflow_template_snapshot: { maxLoops: 2 },
    }
    expect(canLoopAgain(run)).toBe(true)
  })

  it('hides while iteration is below maxLoops (auto-loop budget remains)', () => {
    const run = {
      status: 'FAILED',
      iteration: 1,
      workflow_template_snapshot: { maxLoops: 2 },
    }
    expect(canLoopAgain(run)).toBe(false)
  })

  // Regression: maxLoops === 0 means auto-loop disabled. Every loop attempt
  // is a manual override; the button must surface immediately.
  it('renders when maxLoops is 0 (every loop is an override)', () => {
    const run = {
      status: 'FAILED',
      iteration: 1,
      workflow_template_snapshot: { maxLoops: 0 },
    }
    expect(canLoopAgain(run)).toBe(true)
  })

  it('renders when maxLoops snapshot is missing (treated as 0)', () => {
    const run = { status: 'FAILED', iteration: 1 }
    expect(canLoopAgain(run)).toBe(true)
  })

  it('defaults iteration to 1 when missing', () => {
    const run = {
      status: 'FAILED',
      workflow_template_snapshot: { maxLoops: 1 },
    }
    expect(canLoopAgain(run)).toBe(true)
  })
})

describe('canLoopBack', () => {
  it('returns false when run is null or not FAILED', () => {
    expect(canLoopBack(null)).toBe(false)
    expect(canLoopBack({ status: 'COMPLETED' })).toBe(false)
  })

  it('hides when the failed step has onFailureLoopTo configured', () => {
    const run = {
      status: 'FAILED',
      current_step: 'step3',
      steps: [{ step_id: 'step3', status: 'FAILED' }],
      workflow_template_snapshot: {
        steps: [
          { id: 'step1' },
          { id: 'step2' },
          { id: 'step3', onFailureLoopTo: 'step2' },
        ],
      },
    }
    expect(canLoopBack(run)).toBe(false)
  })

  it('shows when the failed step has no onFailureLoopTo', () => {
    const run = {
      status: 'FAILED',
      current_step: 'step3',
      steps: [{ step_id: 'step3', status: 'FAILED' }],
      workflow_template_snapshot: {
        steps: [{ id: 'step3', onFailureLoopTo: null }],
      },
    }
    expect(canLoopBack(run)).toBe(true)
  })

  // Default-to-show keeps the manual loop-back reachable when the snapshot
  // hasn't loaded yet — the backend re-validates the actual request.
  it('shows when the template snapshot is missing entirely', () => {
    const run = {
      status: 'FAILED',
      current_step: 'step3',
      steps: [{ step_id: 'step3', status: 'FAILED' }],
    }
    expect(canLoopBack(run)).toBe(true)
  })

  it('shows when the failed step cannot be identified', () => {
    const run = { status: 'FAILED', steps: [], current_step: null }
    expect(canLoopBack(run)).toBe(true)
  })
})
