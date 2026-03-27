import { describe, expect, it } from 'vitest'

import api from '../src/api/index.js'
import * as workflowTemplateApi from '../src/api/workflowTemplate.js'

describe('workflow template api helpers', () => {
  it('requests the workflow template collection endpoint', async () => {
    expect(typeof workflowTemplateApi.getWorkflowTemplates).toBe('function')

    const seen = []
    const interceptor = api.interceptors.request.use((config) => {
      seen.push({
        url: config.url,
        method: config.method
      })
      return Promise.reject(new Error('stop request'))
    })

    try {
      await expect(workflowTemplateApi.getWorkflowTemplates()).rejects.toThrow('stop request')
    } finally {
      api.interceptors.request.eject(interceptor)
    }

    expect(seen).toEqual([
      {
        url: '/workflow-template',
        method: 'get'
      }
    ])
  })

  it('requests workflow template detail by id', async () => {
    expect(typeof workflowTemplateApi.getWorkflowTemplateById).toBe('function')

    const seen = []
    const interceptor = api.interceptors.request.use((config) => {
      seen.push({
        url: config.url,
        method: config.method
      })
      return Promise.reject(new Error('stop request'))
    })

    try {
      await expect(workflowTemplateApi.getWorkflowTemplateById('quick-fix-v1')).rejects.toThrow('stop request')
    } finally {
      api.interceptors.request.eject(interceptor)
    }

    expect(seen).toEqual([
      {
        url: '/workflow-template/quick-fix-v1',
        method: 'get'
      }
    ])
  })

  it('creates workflow templates through the collection endpoint', async () => {
    expect(typeof workflowTemplateApi.createWorkflowTemplate).toBe('function')

    const seen = []
    const interceptor = api.interceptors.request.use((config) => {
      seen.push({
        url: config.url,
        method: config.method,
        data: config.data
      })
      return Promise.reject(new Error('stop request'))
    })

    const payload = {
      template_id: 'bugfix-flow-v1',
      name: 'Bugfix Flow',
      steps: [
        { id: 'design', name: 'Design', instructionPrompt: 'Analyze', agentId: null },
        { id: 'test', name: 'Test', instructionPrompt: 'Verify', agentId: 3 }
      ]
    }

    try {
      await expect(workflowTemplateApi.createWorkflowTemplate(payload)).rejects.toThrow('stop request')
    } finally {
      api.interceptors.request.eject(interceptor)
    }

    expect(seen).toEqual([
      {
        url: '/workflow-template',
        method: 'post',
        data: payload
      }
    ])
  })

  it('deletes workflow templates by id', async () => {
    expect(typeof workflowTemplateApi.deleteWorkflowTemplate).toBe('function')

    const seen = []
    const interceptor = api.interceptors.request.use((config) => {
      seen.push({
        url: config.url,
        method: config.method
      })
      return Promise.reject(new Error('stop request'))
    })

    try {
      await expect(workflowTemplateApi.deleteWorkflowTemplate('bugfix-flow-v1')).rejects.toThrow('stop request')
    } finally {
      api.interceptors.request.eject(interceptor)
    }

    expect(seen).toEqual([
      {
        url: '/workflow-template/bugfix-flow-v1',
        method: 'delete'
      }
    ])
  })

  it('keeps getWorkflowTemplate compatible with the singleton default template consumer', async () => {
    const seen = []
    const interceptor = api.interceptors.request.use((config) => {
      seen.push({
        url: config.url,
        method: config.method
      })
      return Promise.reject(new Error('stop request'))
    })

    try {
      await expect(workflowTemplateApi.getWorkflowTemplate()).rejects.toThrow('stop request')
    } finally {
      api.interceptors.request.eject(interceptor)
    }

    expect(seen).toEqual([
      {
        url: '/workflow-template/workflow-v1',
        method: 'get'
      }
    ])
  })
})
