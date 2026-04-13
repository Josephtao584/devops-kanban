import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ElMessageBox } from 'element-plus'
import { nextTick } from 'vue'
import i18n from '../src/locales'
import TaskListItem from '../src/components/task/TaskListItem.vue'

vi.mock('../src/composables/useWorktree', () => ({
  useWorktree: () => ({
    handleWorktree: vi.fn(),
    worktreeLoading: { value: new Set() },
    isWorktreeLoading: () => false,
    getWorktreeClass: () => '',
    getWorktreeTooltip: () => '',
    getWorktreeStatusText: () => '',
    getWorktreeBranchText: () => '',
    hasWorktree: () => false
  })
}))

vi.mock('../src/composables/kanban/useTaskTimer', () => ({
  useTaskTimer: () => ({
    runningTasks: new Set(),
    isTaskRunning: () => false,
    startTaskTimer: vi.fn(),
    stopTaskTimer: vi.fn(),
    formatTaskElapsedTime: () => '',
    cleanup: vi.fn()
  })
}))

vi.mock('../src/api/workflow.js', () => ({
  getWorkflowRun: vi.fn()
}))

const taskWithWorkflow = {
  id: 1,
  title: 'Test task',
  description: 'Test description',
  status: 'IN_PROGRESS',
  priority: 'MEDIUM',
  project_id: 1,
  worktree_status: 'created',
  worktree_path: '/tmp/test',
  source: 'manual',
  workflow_run_id: 10,
  created_at: '2026-01-01',
  updated_at: '2026-01-01'
}

function mountItem() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(TaskListItem, {
    props: { task: taskWithWorkflow, selected: false, compact: false, workflowExpanded: true },
    global: {
      plugins: [i18n, pinia],
      stubs: { 'el-checkbox': true }
    }
  })
}

async function flushAll() {
  await nextTick()
  await nextTick()
  await nextTick()
}

describe('TaskListItem workflow failure notification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.spyOn(ElMessageBox, 'alert').mockResolvedValue()
  })

  it('shows ElMessageBox.alert with step error and wide dialog style', async () => {
    const { getWorkflowRun } = await import('../src/api/workflow.js')

    getWorkflowRun.mockResolvedValue({
      success: true,
      data: {
        id: 10,
        task_id: 1,
        status: 'FAILED',
        steps: [
          {
            step_id: 'step-1',
            name: '开发实现',
            status: 'FAILED',
            error: 'Claude Code cannot be launched inside another Claude Code session.',
            session_id: 1,
            started_at: '2026-04-13T03:04:49.081Z',
            completed_at: '2026-04-13T03:04:51.004Z'
          }
        ],
        context: {}
      }
    })

    mountItem()
    await flushAll()

    expect(ElMessageBox.alert).toHaveBeenCalledWith(
      'Claude Code cannot be launched inside another Claude Code session.',
      '工作流执行失败',
      {
        type: 'error',
        customStyle: { maxWidth: '680px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }
      }
    )
  })

  it('shows fallback error message when no step error', async () => {
    const { getWorkflowRun } = await import('../src/api/workflow.js')

    getWorkflowRun.mockResolvedValue({
      success: true,
      data: {
        id: 10,
        task_id: 1,
        status: 'FAILED',
        steps: [{ step_id: 's1', name: 'test', status: 'FAILED', error: null }],
        context: { error: 'Something went wrong' }
      }
    })

    mountItem()
    await flushAll()

    expect(ElMessageBox.alert).toHaveBeenCalledWith(
      'Something went wrong',
      '工作流执行失败',
      {
        type: 'error',
        customStyle: { maxWidth: '680px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }
      }
    )
  })

  it('does not show alert when workflow is RUNNING', async () => {
    const { getWorkflowRun } = await import('../src/api/workflow.js')

    getWorkflowRun.mockResolvedValue({
      success: true,
      data: { id: 10, task_id: 1, status: 'RUNNING', steps: [], context: {} }
    })

    mountItem()
    await flushAll()

    expect(ElMessageBox.alert).not.toHaveBeenCalled()
  })
})
