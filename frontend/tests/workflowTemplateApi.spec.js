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

  it('keeps getWorkflowTemplate compatible with the config page singleton consumer', async () => {
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
        url: '/workflow-template/dev-workflow-v1',
        method: 'get'
      }
    ])
  })
})
