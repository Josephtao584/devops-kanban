import { describe, expect, it } from 'vitest'

import api from '../src/api/index.js'
import * as gitApi from '../src/api/git.js'
import { createTask, updateTask } from '../src/api/task.js'

describe('git api exports', () => {
  it('keeps push and removes mergeBranch from the public api', () => {
    expect(typeof gitApi.push).toBe('function')
    expect('mergeBranch' in gitApi).toBe(false)
  })
})

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
})
