import { describe, it, expect } from 'vitest'
import { canLoopAgain, canLoopBack, DEFAULT_MAX_LOOPS } from '../src/utils/loopActionVisibility.js'

describe('canLoopAgain', () => {
  it('returns false when run is null', () => {
    expect(canLoopAgain(null)).toBe(false)
    expect(canLoopAgain(undefined)).toBe(false)
  })

  it('returns false when run is not FAILED', () => {
    const run = {
      status: 'COMPLETED',
      iteration: 5,
    }
    expect(canLoopAgain(run)).toBe(false)
  })

  // Regression: previously used iteration > maxLoops which left
  // iteration === DEFAULT_MAX_LOOPS as an unreachable state — backend rejects
  // the next auto-loop (would be DEFAULT_MAX_LOOPS+1) but the button stays hidden.
  it('renders when iteration equals DEFAULT_MAX_LOOPS on a FAILED run', () => {
    const run = {
      status: 'FAILED',
      iteration: DEFAULT_MAX_LOOPS,
    }
    expect(canLoopAgain(run)).toBe(true)
  })

  it('renders when iteration exceeds DEFAULT_MAX_LOOPS', () => {
    const run = {
      status: 'FAILED',
      iteration: DEFAULT_MAX_LOOPS + 3,
    }
    expect(canLoopAgain(run)).toBe(true)
  })

  it('hides while iteration is below DEFAULT_MAX_LOOPS (auto-loop budget remains)', () => {
    const run = {
      status: 'FAILED',
      iteration: DEFAULT_MAX_LOOPS - 1,
    }
    expect(canLoopAgain(run)).toBe(false)
  })

  it('defaults iteration to 1 when missing (still below DEFAULT_MAX_LOOPS)', () => {
    const run = { status: 'FAILED' }
    expect(canLoopAgain(run)).toBe(false)
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
