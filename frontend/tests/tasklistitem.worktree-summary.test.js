import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const {
  createWorktreeMock,
  deleteWorktreeMock,
  getWorkflowRunMock
} = vi.hoisted(() => ({
  createWorktreeMock: vi.fn(),
  deleteWorktreeMock: vi.fn(),
  getWorkflowRunMock: vi.fn(() => Promise.resolve({ success: true, data: null }))
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (_key, fallback) => fallback
  })
}))

vi.mock('../src/composables/useWorktree', () => ({
  useWorktree: () => ({
    isWorktreeLoading: () => false,
    getWorktreeClass: (task) => `worktree-${task.worktree_status || 'none'}`,
    getWorktreeTooltip: () => 'worktree tooltip',
    getWorktreeStatusText: (task) => (task.worktree_status === 'created' ? '已创建' : '未创建'),
    createWorktree: createWorktreeMock,
    deleteWorktree: deleteWorktreeMock
  })
}))

vi.mock('../src/api/workflow', () => ({
  getWorkflowRun: getWorkflowRunMock
}))

import TaskListItem from '../src/components/task/TaskListItem.vue'
import zh from '../src/locales/zh.js'

const createTask = (overrides = {}) => ({
  id: 1,
  title: 'Task title',
  status: 'IN_PROGRESS',
  priority: 'HIGH',
  description: 'Task description',
  workflow_run_id: 1,
  worktree_status: 'created',
  worktree_branch: 'task/devops-branch',
  worktree_path: '/tmp/devops/worktrees/task-1',
  ...overrides
})

const createWorkflow = () => ({
  stages: [
    {
      id: 'stage-1',
      nodes: []
    }
  ]
})

const mountTaskListItem = (taskOverrides = {}) => mount(TaskListItem, {
  props: {
    task: createTask(taskOverrides),
    workflowExpanded: true,
    workflow: createWorkflow()
  },
  global: {
    stubs: {
      PriorityBadge: true,
      InlineWorkflowPanel: true,
      'el-icon': true,
      'el-tag': true
    },
    mocks: {
      $t: (_, fallback) => fallback
    }
  }
})

describe('TaskListItem worktree summary', () => {
  beforeEach(() => {
    createWorktreeMock.mockReset()
    deleteWorktreeMock.mockReset()
    getWorkflowRunMock.mockClear()
  })

  it('defines a zh translation for git.path', () => {
    expect(zh.git.path).toBe('路径')
  })

  it('renders branch and path in separate rows after quick actions', () => {
    const wrapper = mountTaskListItem()

    const rows = wrapper.findAll('.worktree-summary-row')
    const branchValue = wrapper.find('.worktree-summary-branch')
    const pathValue = wrapper.find('.worktree-summary-path')
    const workflowSections = wrapper.findAll('.workflow-section')
    const quickActionsIndex = workflowSections.findIndex(section => section.classes().includes('quick-actions'))
    const worktreeIndex = workflowSections.findIndex(section => section.classes().includes('worktree-summary'))

    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('Branch')
    expect(rows[1].text()).toContain('Path')
    expect(branchValue.exists()).toBe(true)
    expect(pathValue.exists()).toBe(true)
    expect(branchValue.element.parentElement).not.toBe(pathValue.element.parentElement)
    expect(branchValue.text()).toContain('task/devops-branch')
    expect(pathValue.text()).toContain('/tmp/devops/worktrees/task-1')
    expect(worktreeIndex).toBeGreaterThan(quickActionsIndex)
  })

  it('marks long path content as wrap-friendly in kanban cards', () => {
    const wrapper = mountTaskListItem({
      worktree_path: '/tmp/claude-repos/1/worktrees/devops/very/long/path/that/should/remain/visible/in/kanban/view'
    })

    const pathValue = wrapper.find('.worktree-summary-path')

    expect(pathValue.exists()).toBe(true)
    expect(pathValue.classes()).toContain('worktree-summary-path-wrap')
  })

  it('shows delete worktree button only when worktree is created', () => {
    const createdWrapper = mountTaskListItem()
    const noneWrapper = mountTaskListItem({
      worktree_status: 'none',
      worktree_branch: null,
      worktree_path: null
    })

    expect(createdWrapper.find('.worktree-summary-delete-btn').exists()).toBe(true)
    expect(noneWrapper.find('.worktree-summary-delete-btn').exists()).toBe(false)
  })

  it('renders formatted task description safely', () => {
    const wrapper = mountTaskListItem({
      description: '<img src=x onerror=alert(1)> **重点**\n`code`'
    })

    const description = wrapper.find('.task-description')
    expect(description.exists()).toBe(true)
    expect(description.html()).toContain('<strong>重点</strong>')
    expect(description.html()).toContain('<code>code</code>')
    expect(description.html()).not.toContain('<img')
    expect(description.text()).toContain('重点')
  })

  it('uses deleteWorktree when delete button is clicked', async () => {
    deleteWorktreeMock.mockImplementation(async (task, onUpdate) => {
      onUpdate?.(task)
      return task
    })

    const wrapper = mountTaskListItem()

    await wrapper.find('.worktree-summary-delete-btn').trigger('click')

    expect(deleteWorktreeMock).toHaveBeenCalledTimes(1)
    expect(createWorktreeMock).not.toHaveBeenCalled()

    const [taskArg, onUpdateArg] = deleteWorktreeMock.mock.calls[0]
    expect(taskArg.id).toBe(1)
    expect(typeof onUpdateArg).toBe('function')
    expect(wrapper.emitted('worktree-update')).toHaveLength(1)
    expect(wrapper.emitted('worktree-update')[0][0]).toBe(taskArg)
  })
})
