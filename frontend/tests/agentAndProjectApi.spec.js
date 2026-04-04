import { describe, expect, it } from 'vitest'

import api from '../src/api/index.js'
import * as agentApi from '../src/api/agent.js'
import * as projectApi from '../src/api/project.js'

function captureRequest(callback) {
  const seen = []
  const interceptor = api.interceptors.request.use((config) => {
    seen.push({ url: config.url, method: config.method })
    return Promise.reject(new Error('stop'))
  })
  return { seen, cleanup: () => api.interceptors.request.eject(interceptor) }
}

describe('agent API', () => {
  it('exports CRUD functions', () => {
    expect(agentApi.getAgents).toBeTypeOf('function')
    expect(agentApi.getAgent).toBeTypeOf('function')
    expect(agentApi.createAgent).toBeTypeOf('function')
    expect(agentApi.updateAgent).toBeTypeOf('function')
    expect(agentApi.deleteAgent).toBeTypeOf('function')
  })

  it('getAgents calls GET /agents', async () => {
    const { seen, cleanup } = captureRequest()
    try {
      await expect(agentApi.getAgents()).rejects.toThrow('stop')
    } finally { cleanup() }
    expect(seen[0]).toEqual({ url: '/agents', method: 'get' })
  })

  it('getAgent calls GET /agents/:id', async () => {
    const { seen, cleanup } = captureRequest()
    try {
      await expect(agentApi.getAgent(5)).rejects.toThrow('stop')
    } finally { cleanup() }
    expect(seen[0]).toEqual({ url: '/agents/5', method: 'get' })
  })

  it('createAgent calls POST /agents', async () => {
    const seen = []
    const interceptor = api.interceptors.request.use((config) => {
      seen.push({ url: config.url, method: config.method, data: config.data })
      return Promise.reject(new Error('stop'))
    })
    try {
      await expect(agentApi.createAgent({ name: 'Test' })).rejects.toThrow('stop')
    } finally { api.interceptors.request.eject(interceptor) }
    expect(seen[0]).toEqual({ url: '/agents', method: 'post', data: { name: 'Test' } })
  })

  it('updateAgent calls PUT /agents/:id', async () => {
    const { seen, cleanup } = captureRequest()
    try {
      await expect(agentApi.updateAgent(3, { name: 'Updated' })).rejects.toThrow('stop')
    } finally { cleanup() }
    expect(seen[0]).toEqual({ url: '/agents/3', method: 'put' })
  })

  it('deleteAgent calls DELETE /agents/:id', async () => {
    const { seen, cleanup } = captureRequest()
    try {
      await expect(agentApi.deleteAgent(7)).rejects.toThrow('stop')
    } finally { cleanup() }
    expect(seen[0]).toEqual({ url: '/agents/7', method: 'delete' })
  })
})

describe('project API', () => {
  it('exports CRUD functions', () => {
    expect(projectApi.getProjects).toBeTypeOf('function')
    expect(projectApi.getProject).toBeTypeOf('function')
    expect(projectApi.createProject).toBeTypeOf('function')
    expect(projectApi.updateProject).toBeTypeOf('function')
    expect(projectApi.deleteProject).toBeTypeOf('function')
  })

  it('getProjects calls GET /projects', async () => {
    const { seen, cleanup } = captureRequest()
    try {
      await expect(projectApi.getProjects()).rejects.toThrow('stop')
    } finally { cleanup() }
    expect(seen[0]).toEqual({ url: '/projects', method: 'get' })
  })

  it('getProject calls GET /projects/:id', async () => {
    const { seen, cleanup } = captureRequest()
    try {
      await expect(projectApi.getProject(5)).rejects.toThrow('stop')
    } finally { cleanup() }
    expect(seen[0]).toEqual({ url: '/projects/5', method: 'get' })
  })

  it('createProject calls POST /projects', async () => {
    const { seen, cleanup } = captureRequest()
    try {
      await expect(projectApi.createProject({ name: 'Test' })).rejects.toThrow('stop')
    } finally { cleanup() }
    expect(seen[0]).toEqual({ url: '/projects', method: 'post' })
  })

  it('updateProject calls PUT /projects/:id', async () => {
    const { seen, cleanup } = captureRequest()
    try {
      await expect(projectApi.updateProject(3, { name: 'Updated' })).rejects.toThrow('stop')
    } finally { cleanup() }
    expect(seen[0]).toEqual({ url: '/projects/3', method: 'put' })
  })

  it('deleteProject calls DELETE /projects/:id', async () => {
    const { seen, cleanup } = captureRequest()
    try {
      await expect(projectApi.deleteProject(7)).rejects.toThrow('stop')
    } finally { cleanup() }
    expect(seen[0]).toEqual({ url: '/projects/7', method: 'delete' })
  })
})
