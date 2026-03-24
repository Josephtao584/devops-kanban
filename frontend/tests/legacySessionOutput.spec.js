import { describe, expect, it } from 'vitest'
import workflowRuns from '../../data-sample/workflow_runs.json'

describe('legacy output assumptions', () => {
  it('sample workflow step snapshots do not carry output fields anymore', () => {
    for (const run of workflowRuns) {
      for (const step of run.steps || []) {
        expect(Object.prototype.hasOwnProperty.call(step, 'output')).toBe(false)
      }
    }
  })
})
