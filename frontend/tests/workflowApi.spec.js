import { describe, expect, it } from 'vitest'

import api from '../src/api/index.js'
import * as workflowApi from '../src/api/workflow.js'

function captureRequest() {
  const seen = []
  const interceptor = api.interceptors.request.use((config) => {
    seen.push({ url: config.url, method: config.method, data: config.data })
    return Promise.reject(new Error('stop'))
  })
  return { seen, cleanup: () => api.interceptors.request.eject(interceptor) }
}

describe('workflow API', () => {
  it('getWorkflowRun calls GET /workflows/runs/:id', async () => {
    const { seen, cleanup } = captureRequest()
    try {
      await expect(workflowApi.getWorkflowRun(10)).rejects.toThrow('stop')
    } finally { cleanup() }
    expect(seen[0]).toEqual({ url: '/workflows/runs/10', method: 'get', data: undefined })
  })

  it('cancelWorkflow calls POST /workflows/runs/:id/cancel', async () => {
    const { seen, cleanup } = captureRequest()
    try {
      await expect(workflowApi.cancelWorkflow(5)).rejects.toThrow('stop')
    } finally { cleanup() }
    expect(seen[0]).toEqual({ url: '/workflows/runs/5/cancel', method: 'post', data: undefined })
  })

  it('retryWorkflow calls POST /workflows/runs/:id/retry', async () => {
    const { seen, cleanup } = captureRequest()
    try {
      await expect(workflowApi.retryWorkflow(5)).rejects.toThrow('stop')
    } finally { cleanup() }
    // retryWorkflow always sends a JSON body so the backend's body parser is
    // happy. Without retryNote the body is just {}.
    expect(seen[0]).toEqual({ url: '/workflows/runs/5/retry', method: 'post', data: {} })
  })

  it('resumeWorkflow sends POST with data payload', async () => {
    const { seen, cleanup } = captureRequest()
    try {
      await expect(workflowApi.resumeWorkflow(5, { stepId: 's1', input: 'ok' })).rejects.toThrow('stop')
    } finally { cleanup() }
    expect(seen[0]).toEqual({
      url: '/workflows/runs/5/resume',
      method: 'post',
      data: { stepId: 's1', input: 'ok' }
    })
  })

  it('loopWorkflow sends POST with data payload', async () => {
    const { seen, cleanup } = captureRequest()
    try {
      await expect(workflowApi.loopWorkflow(7, { fromStepId: 's2', override: true })).rejects.toThrow('stop')
    } finally { cleanup() }
    expect(seen[0]).toEqual({
      url: '/workflows/runs/7/loop',
      method: 'post',
      data: { fromStepId: 's2', override: true }
    })
  })
})
