import { describe, expect, it } from 'vitest'

import api from '../src/api/index.js'
import * as gitApi from '../src/api/git.js'
import { createTask, startTask, updateTask } from '../src/api/task.js'

describe('task api payload normalization', () => {
  it('sends numeric project_id and iteration_id from string inputs', async () => {
    const seen = []
    const interceptor = api.interceptors.request.use((config) => {
      seen.push({
        url: config.url,
        method: config.method,
        data: config.data
      })
      return Promise.reject(new Error('stop request'))
    })

    try {
      await expect(createTask({
        title: '新增接口',
        projectId: '4',
        project_id: '4',
        iterationId: '4',
        iteration_id: '4'
      })).rejects.toThrow('stop request')

      await expect(updateTask(1, {
        projectId: '4',
        project_id: '4',
        iterationId: '4',
        iteration_id: '4'
      })).rejects.toThrow('stop request')
    } finally {
      api.interceptors.request.eject(interceptor)
    }

    expect(seen).toHaveLength(2)
    expect(seen[0].data).toEqual({
      title: '新增接口',
      projectId: '4',
      project_id: 4,
      iterationId: '4',
      iteration_id: 4
    })
    expect(seen[1].data).toEqual({
      projectId: '4',
      project_id: 4,
      iterationId: '4',
      iteration_id: 4
    })
  })

  it('sends selected workflow template when starting a task', async () => {
    const seen = []
    const interceptor = api.interceptors.request.use((config) => {
      seen.push({
        url: config.url,
        method: config.method,
        data: config.data
      })
      return Promise.reject(new Error('stop request'))
    })

    try {
      await expect(startTask(7, {
        workflow_template_id: 'quick-fix-v1'
      })).rejects.toThrow('stop request')
    } finally {
      api.interceptors.request.eject(interceptor)
    }

    expect(seen).toHaveLength(1)
    expect(seen[0]).toEqual({
      url: '/tasks/7/start',
      method: 'post',
      data: {
        workflow_template_id: 'quick-fix-v1'
      }
    })
  })
})

describe('api error normalization', () => {
  it('uses backend response message for rejected 400 requests', async () => {
    const interceptor = api.interceptors.request.use((config) => {
      const error = new Error('Request failed with status code 400')
      error.config = config
      error.response = {
        status: 400,
        data: {
          success: false,
          message: '项目未配置本地路径或路径不存在，请先在项目设置中添加有效的 local_path',
          data: null,
          error: null
        }
      }
      return Promise.reject(error)
    })

    try {
      await expect(startTask(7, {
        workflow_template_id: 'quick-fix-v1'
      })).rejects.toMatchObject({
        message: '项目未配置本地路径或路径不存在，请先在项目设置中添加有效的 local_path'
      })
    } finally {
      api.interceptors.request.eject(interceptor)
    }
  })
})

describe('task reorder', () => {
  it('reorderTasks maps tasks to ordered updates', async () => {
    const seen = []
    const interceptor = api.interceptors.request.use((config) => {
      seen.push({ url: config.url, method: config.method, data: config.data })
      return Promise.reject(new Error('stop'))
    })

    const { reorderTasks } = await import('../src/api/task.js')

    try {
      await expect(reorderTasks([{ id: 5 }, { id: 3 }, { id: 7 }])).rejects.toThrow('stop')
    } finally {
      api.interceptors.request.eject(interceptor)
    }

    const reorderCall = seen.find(s => s.url === '/tasks/reorder')
    expect(reorderCall).toBeTruthy()
    expect(reorderCall.data).toEqual({
      updates: [{ id: 5, order: 0 }, { id: 3, order: 1 }, { id: 7, order: 2 }]
    })
  })

  it('reorderTasks handles empty array', async () => {
    const seen = []
    const interceptor = api.interceptors.request.use((config) => {
      seen.push({ url: config.url, data: config.data })
      return Promise.reject(new Error('stop'))
    })

    const { reorderTasks } = await import('../src/api/task.js')

    try {
      await expect(reorderTasks([])).rejects.toThrow('stop')
    } finally {
      api.interceptors.request.eject(interceptor)
    }

    const reorderCall = seen.find(s => s.url === '/tasks/reorder')
    expect(reorderCall.data).toEqual({ updates: [] })
  })
})
