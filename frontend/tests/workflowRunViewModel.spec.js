import { describe, expect, it } from 'vitest'

import {
  normalizeWorkflowStatus,
  getAllNodes,
  getWorkflowProgress,
  getWorkflowDisplayStatus,
  toTimelineWorkflow,
  getCurrentWorkflowNode
} from '../src/utils/workflowRunViewModel'

describe('workflowRunViewModel', () => {
  describe('normalizeWorkflowStatus', () => {
    it('maps PENDING to PENDING', () => {
      expect(normalizeWorkflowStatus('PENDING')).toBe('PENDING')
    })

    it('maps RUNNING to IN_PROGRESS', () => {
      expect(normalizeWorkflowStatus('RUNNING')).toBe('IN_PROGRESS')
    })

    it('maps COMPLETED to DONE', () => {
      expect(normalizeWorkflowStatus('COMPLETED')).toBe('DONE')
    })

    it('maps SUSPENDED to SUSPENDED', () => {
      expect(normalizeWorkflowStatus('SUSPENDED')).toBe('SUSPENDED')
    })

    it('maps FAILED to FAILED', () => {
      expect(normalizeWorkflowStatus('FAILED')).toBe('FAILED')
    })

    it('maps CANCELLED to CANCELLED', () => {
      expect(normalizeWorkflowStatus('CANCELLED')).toBe('CANCELLED')
    })

    it('returns status unchanged for unknown status', () => {
      expect(normalizeWorkflowStatus('UNKNOWN')).toBe('UNKNOWN')
    })

    it('defaults to PENDING for null/undefined', () => {
      expect(normalizeWorkflowStatus(null)).toBe('PENDING')
      expect(normalizeWorkflowStatus(undefined)).toBe('PENDING')
    })
  })

  describe('getAllNodes', () => {
    it('flattens all nodes from all stages', () => {
      const workflow = {
        stages: [
          { nodes: [{ id: 1 }, { id: 2 }] },
          { nodes: [{ id: 3 }] }
        ]
      }
      expect(getAllNodes(workflow)).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
    })

    it('returns empty array for null workflow', () => {
      expect(getAllNodes(null)).toEqual([])
    })

    it('returns empty array for workflow with no stages', () => {
      expect(getAllNodes({})).toEqual([])
    })

    it('handles stages with no nodes', () => {
      const workflow = {
        stages: [{ nodes: [{ id: 1 }] }, {}]
      }
      expect(getAllNodes(workflow)).toEqual([{ id: 1 }])
    })
  })

  describe('getWorkflowProgress', () => {
    it('calculates progress from nodes', () => {
      const workflow = {
        stages: [
          { nodes: [{ status: 'DONE' }, { status: 'IN_PROGRESS' }] },
          { nodes: [{ status: 'DONE' }] }
        ]
      }
      const progress = getWorkflowProgress(workflow)
      expect(progress).toEqual({ completed: 2, total: 3, percent: 67 })
    })

    it('returns zero for empty workflow', () => {
      expect(getWorkflowProgress(null)).toEqual({ completed: 0, total: 0, percent: 0 })
    })
  })

  describe('getWorkflowDisplayStatus', () => {
    it('returns pending for null', () => {
      expect(getWorkflowDisplayStatus(null)).toBe('pending')
    })

    it('returns running for RUNNING', () => {
      expect(getWorkflowDisplayStatus({ status: 'RUNNING' })).toBe('running')
    })

    it('returns running for PENDING', () => {
      expect(getWorkflowDisplayStatus({ status: 'PENDING' })).toBe('running')
    })

    it('returns done for COMPLETED', () => {
      expect(getWorkflowDisplayStatus({ status: 'COMPLETED' })).toBe('done')
    })

    it('returns failed for FAILED', () => {
      expect(getWorkflowDisplayStatus({ status: 'FAILED' })).toBe('failed')
    })

    it('returns cancelled for CANCELLED', () => {
      expect(getWorkflowDisplayStatus({ status: 'CANCELLED' })).toBe('cancelled')
    })

    it('returns suspended for SUSPENDED with suspended steps', () => {
      const run = { status: 'SUSPENDED', steps: [{ status: 'SUSPENDED' }] }
      expect(getWorkflowDisplayStatus(run)).toBe('suspended')
    })

    it('returns running for SUSPENDED without suspended steps', () => {
      const run = { status: 'SUSPENDED', steps: [{ status: 'RUNNING' }] }
      expect(getWorkflowDisplayStatus(run)).toBe('running')
    })

    it('returns pending for unknown status', () => {
      expect(getWorkflowDisplayStatus({ status: 'UNKNOWN' })).toBe('pending')
    })
  })

  describe('toTimelineWorkflow', () => {
    it('returns null for null run', () => {
      expect(toTimelineWorkflow(null)).toBeNull()
    })

    it('transforms run to timeline format', () => {
      const run = {
        id: 'run-1',
        workflow_template_snapshot: {
          name: 'Test Workflow',
          steps: [{ id: 'step-a', role: 'ARCHITECT', agentId: 1 }]
        },
        current_step: 'step-a',
        steps: [
          { step_id: 'step-a', name: 'Step A', status: 'COMPLETED', session_id: 'sess-1' }
        ]
      }

      const result = toTimelineWorkflow(run)

      expect(result.id).toBe('run-1')
      expect(result.name).toBe('Test Workflow')
      expect(result.currentNodeId).toBe('step-a')
      expect(result.stages).toHaveLength(1)
      expect(result.stages[0].nodes[0].status).toBe('DONE')
      expect(result.stages[0].nodes[0].agentId).toBe(1)
      expect(result.stages[0].nodes[0].sessionId).toBe('sess-1')
    })

    it('handles run without snapshot', () => {
      const run = {
        id: 'run-2',
        steps: [{ step_id: 's1', name: 'Step 1', status: 'RUNNING' }]
      }

      const result = toTimelineWorkflow(run)
      expect(result.stages).toHaveLength(1)
      expect(result.stages[0].nodes[0].status).toBe('IN_PROGRESS')
    })
  })

  describe('getCurrentWorkflowNode', () => {
    it('finds node by current_step id', () => {
      const run = { current_step: 'node-2' }
      const workflow = {
        stages: [
          { nodes: [{ id: 'node-1' }, { id: 'node-2', status: 'PENDING' }] }
        ]
      }

      expect(getCurrentWorkflowNode(run, workflow)).toEqual({ id: 'node-2', status: 'PENDING' })
    })

    it('falls back to first IN_PROGRESS node', () => {
      const run = { current_step: null }
      const workflow = {
        stages: [
          { nodes: [{ id: 'n1', status: 'DONE' }, { id: 'n2', status: 'IN_PROGRESS' }] }
        ]
      }

      expect(getCurrentWorkflowNode(run, workflow)).toEqual({ id: 'n2', status: 'IN_PROGRESS' })
    })

    it('falls back to first FAILED node', () => {
      const run = {}
      const workflow = {
        stages: [{ nodes: [{ id: 'n1', status: 'FAILED' }] }]
      }

      expect(getCurrentWorkflowNode(run, workflow)).toEqual({ id: 'n1', status: 'FAILED' })
    })

    it('returns null for null inputs', () => {
      expect(getCurrentWorkflowNode(null, null)).toBeNull()
      expect(getCurrentWorkflowNode({}, null)).toBeNull()
      expect(getCurrentWorkflowNode(null, { stages: [] })).toBeNull()
    })

    it('returns null when no matching node found', () => {
      const run = {}
      const workflow = { stages: [{ nodes: [{ id: 'n1', status: 'DONE' }] }] }
      expect(getCurrentWorkflowNode(run, workflow)).toBeNull()
    })
  })
})
