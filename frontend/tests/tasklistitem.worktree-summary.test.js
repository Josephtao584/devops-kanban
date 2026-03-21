import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import TaskListItem from '../src/components/task/TaskListItem.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (_key, fallback) => fallback
  })
}))

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

describe('TaskListItem worktree summary', () => {
  it('renders branch and path in separate rows after quick actions', () => {
    const wrapper = mount(TaskListItem, {
      props: {
        task: createTask(),
        workflowExpanded: true,
        workflow: {
          stages: [
            {
              id: 'stage-1',
              nodes: []
            }
          ]
        }
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
    const wrapper = mount(TaskListItem, {
      props: {
        task: createTask({
          worktree_path: '/tmp/claude-repos/1/worktrees/devops/very/long/path/that/should/remain/visible/in/kanban/view'
        }),
        workflowExpanded: true,
        workflow: {
          stages: [
            {
              id: 'stage-1',
              nodes: []
            }
          ]
        }
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

    const pathValue = wrapper.find('.worktree-summary-path')

    expect(pathValue.exists()).toBe(true)
    expect(pathValue.classes()).toContain('worktree-summary-path-wrap')
  })
})
