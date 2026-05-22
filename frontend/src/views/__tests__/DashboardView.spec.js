import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../api/dashboard.js', () => ({
  getOverview: vi.fn(),
}))
vi.mock('../../api/team.js', () => ({
  getTeams: vi.fn(),
}))
vi.mock('../../api/project.js', () => ({
  getProjects: vi.fn(),
}))

import DashboardView from '../DashboardView.vue'
import { getOverview } from '../../api/dashboard.js'
import { getTeams } from '../../api/team.js'
import { getProjects } from '../../api/project.js'

const sampleOverview = {
  scope: { teamId: null, projectId: null, teamName: null, projectName: null },
  sessions:  { running: 1, idle: 0, recent7d: 5, total: 20 },
  tasks:     { byStatus: { TODO: 1, IN_PROGRESS: 0, DONE: 2, BLOCKED: 0, CANCELLED: 0, REQUIREMENTS: 0 },
                recent7dDone: 1, total: 3 },
  workflows: { running: 0, suspended: 0, recent7dCompleted: 0, recent7dFailed: 0, total: 0 },
  agentTop: [{ agentId: 1, name: 'A1', sessionsTotal: 10, sessionsRecent7d: 3, successRate: 0.8 }],
  projectTop: [{ projectId: 5, name: 'P5', tasksTotal: 7, sessionsTotal: 3, sessionsRecent7d: 1 }],
  teamTop:    [{ teamId: 1, name: 'T1', projectCount: 2, tasksTotal: 7, sessionsRecent7d: 1 }],
  trend30d: Array.from({ length: 30 }, (_, i) => ({ date: `2026-04-${i+1}`, sessionsStarted: 0, tasksCompleted: 0, workflowsCompleted: 0 })),
}

describe('DashboardView', () => {
  it('loads overview on mount and renders cards', async () => {
    getTeams.mockResolvedValue({ success: true, data: [{ id: 1, name: 'T1' }] })
    getProjects.mockResolvedValue({ success: true, data: [{ id: 5, name: 'P5', team_id: 1 }] })
    getOverview.mockResolvedValue({ success: true, data: sampleOverview })
    const w = mount(DashboardView, { global: { mocks: { $t: (k) => k } }, stubs: { TrendChart: true, StatusDistribution: true } })
    await flushPromises()
    expect(getOverview).toHaveBeenCalledTimes(1)
    expect(w.text()).toContain('A1')
    expect(w.text()).toContain('P5')
  })

  it('reloads when scope changes', async () => {
    getTeams.mockResolvedValue({ success: true, data: [{ id: 1, name: 'T1' }] })
    getProjects.mockResolvedValue({ success: true, data: [] })
    getOverview.mockResolvedValue({ success: true, data: sampleOverview })
    const w = mount(DashboardView, { global: { mocks: { $t: (k) => k } }, stubs: { TrendChart: true, StatusDistribution: true } })
    await flushPromises()
    w.vm.scope = { teamId: 1, projectId: null }
    await flushPromises()
    expect(getOverview).toHaveBeenCalledTimes(2)
    expect(getOverview.mock.calls[1][0]).toEqual({ teamId: 1, projectId: null })
  })

  it('navigates to agent detail on leaderboard select', async () => {
    getTeams.mockResolvedValue({ success: true, data: [] })
    getProjects.mockResolvedValue({ success: true, data: [] })
    getOverview.mockResolvedValue({ success: true, data: sampleOverview })
    const push = vi.fn()
    const w = mount(DashboardView, {
      global: { mocks: { $t: (k) => k, $router: { push } } },
      stubs: { TrendChart: true, StatusDistribution: true },
    })
    await flushPromises()
    w.vm.onSelectAgent(1)
    expect(push).toHaveBeenCalledWith({ name: 'DashboardAgent', params: { id: 1 } })
  })
})
