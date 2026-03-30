import { describe, expect, it } from 'vitest'

import api from '../src/api/index.js'
import { skillApi } from '../src/api/skill.js'

describe('skillApi', () => {
  it('exports CRUD methods', () => {
    expect(skillApi.list).toBeTypeOf('function')
    expect(skillApi.get).toBeTypeOf('function')
    expect(skillApi.create).toBeTypeOf('function')
    expect(skillApi.update).toBeTypeOf('function')
    expect(skillApi.delete).toBeTypeOf('function')
  })

  it('exports file operation methods', () => {
    expect(skillApi.listFiles).toBeTypeOf('function')
    expect(skillApi.getFile).toBeTypeOf('function')
    expect(skillApi.updateFile).toBeTypeOf('function')
    expect(skillApi.uploadZip).toBeTypeOf('function')
  })

  it('list calls GET /skills', async () => {
    const seen = []
    const interceptor = api.interceptors.request.use((config) => {
      seen.push({ url: config.url, method: config.method })
      return Promise.reject(new Error('stop'))
    })

    try {
      await expect(skillApi.list()).rejects.toThrow('stop')
    } finally {
      api.interceptors.request.eject(interceptor)
    }

    expect(seen).toHaveLength(1)
    expect(seen[0]).toEqual({ url: '/skills', method: 'get' })
  })

  it('get calls GET /skills/:id', async () => {
    const seen = []
    const interceptor = api.interceptors.request.use((config) => {
      seen.push({ url: config.url, method: config.method })
      return Promise.reject(new Error('stop'))
    })

    try {
      await expect(skillApi.get(5)).rejects.toThrow('stop')
    } finally {
      api.interceptors.request.eject(interceptor)
    }

    expect(seen).toHaveLength(1)
    expect(seen[0]).toEqual({ url: '/skills/5', method: 'get' })
  })

  it('create calls POST /skills', async () => {
    const seen = []
    const interceptor = api.interceptors.request.use((config) => {
      seen.push({ url: config.url, method: config.method, data: config.data })
      return Promise.reject(new Error('stop'))
    })

    try {
      await expect(skillApi.create({ name: 'brainstorming', description: '头脑风暴' })).rejects.toThrow('stop')
    } finally {
      api.interceptors.request.eject(interceptor)
    }

    expect(seen).toHaveLength(1)
    expect(seen[0].url).toBe('/skills')
    expect(seen[0].method).toBe('post')
    expect(seen[0].data).toEqual({ name: 'brainstorming', description: '头脑风暴' })
  })

  it('update calls PUT /skills/:id', async () => {
    const seen = []
    const interceptor = api.interceptors.request.use((config) => {
      seen.push({ url: config.url, method: config.method, data: config.data })
      return Promise.reject(new Error('stop'))
    })

    try {
      await expect(skillApi.update(3, { description: '更新描述' })).rejects.toThrow('stop')
    } finally {
      api.interceptors.request.eject(interceptor)
    }

    expect(seen).toHaveLength(1)
    expect(seen[0].url).toBe('/skills/3')
    expect(seen[0].method).toBe('put')
    expect(seen[0].data).toEqual({ description: '更新描述' })
  })

  it('delete calls DELETE /skills/:id', async () => {
    const seen = []
    const interceptor = api.interceptors.request.use((config) => {
      seen.push({ url: config.url, method: config.method })
      return Promise.reject(new Error('stop'))
    })

    try {
      await expect(skillApi.delete(7)).rejects.toThrow('stop')
    } finally {
      api.interceptors.request.eject(interceptor)
    }

    expect(seen).toHaveLength(1)
    expect(seen[0]).toEqual({ url: '/skills/7', method: 'delete' })
  })

  it('listFiles calls GET /skills/:id/files', async () => {
    const seen = []
    const interceptor = api.interceptors.request.use((config) => {
      seen.push({ url: config.url, method: config.method })
      return Promise.reject(new Error('stop'))
    })

    try {
      await expect(skillApi.listFiles(3)).rejects.toThrow('stop')
    } finally {
      api.interceptors.request.eject(interceptor)
    }

    expect(seen).toHaveLength(1)
    expect(seen[0]).toEqual({ url: '/skills/3/files', method: 'get' })
  })

  it('getFile calls GET /skills/:id/files/:path', async () => {
    const seen = []
    const interceptor = api.interceptors.request.use((config) => {
      seen.push({ url: config.url, method: config.method })
      return Promise.reject(new Error('stop'))
    })

    try {
      await expect(skillApi.getFile(3, 'SKILL.md')).rejects.toThrow('stop')
    } finally {
      api.interceptors.request.eject(interceptor)
    }

    expect(seen).toHaveLength(1)
    expect(seen[0]).toEqual({ url: '/skills/3/files/SKILL.md', method: 'get' })
  })

  it('updateFile calls PUT /skills/:id/files/:path', async () => {
    const seen = []
    const interceptor = api.interceptors.request.use((config) => {
      seen.push({ url: config.url, method: config.method, data: config.data })
      return Promise.reject(new Error('stop'))
    })

    try {
      await expect(skillApi.updateFile(3, 'SKILL.md', '# Updated')).rejects.toThrow('stop')
    } finally {
      api.interceptors.request.eject(interceptor)
    }

    expect(seen).toHaveLength(1)
    expect(seen[0].url).toBe('/skills/3/files/SKILL.md')
    expect(seen[0].method).toBe('put')
    expect(seen[0].data).toEqual({ content: '# Updated' })
  })

  it('uploadZip calls POST /skills/:id/upload-zip', async () => {
    const seen = []
    const interceptor = api.interceptors.request.use((config) => {
      seen.push({ url: config.url, method: config.method, data: config.data })
      return Promise.reject(new Error('stop'))
    })

    try {
      await expect(skillApi.uploadZip(3, 'base64data==')).rejects.toThrow('stop')
    } finally {
      api.interceptors.request.eject(interceptor)
    }

    expect(seen).toHaveLength(1)
    expect(seen[0].url).toBe('/skills/3/upload-zip')
    expect(seen[0].method).toBe('post')
    expect(seen[0].data).toEqual({ zip: 'base64data==' })
  })
})
