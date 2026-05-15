import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ElMessageBox } from 'element-plus'
import { nextTick } from 'vue'
import i18n from '../src/locales'
import TaskListItem from '../src/components/task/TaskListItem.vue'

const mockWorkflowStore = vi.hoisted(() => ({
  getWorkflowRun: vi.fn(),
  cancelWorkflow: vi.fn(),
  retryWorkflow: vi.fn(),
  resumeWorkflow: vi.fn(),
  loading: { value: false },
  error: { value: null }
}))

vi.mock('../src/stores/workflowStore', () => ({
  useWorkflowStore: () => mockWorkflowStore
}))

vi.mock('../src/stores/workflowTemplateStore', () => ({
  useWorkflowTemplateStore: () => ({
    loading: { value: false },
    error: { value: null },
    fetchTemplates: vi.fn(),
    getWorkflowTemplateById: vi.fn()
  })
}))

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

vi.mock('../src/composables/kanban/useWorkflowRunPolling', () => ({
  useWorkflowRunPolling: ({ fetchFn, isTerminal, getStatus }) => ({
    pollingEnabled: { value: true },
    isPolling: { value: false },
    startPolling: vi.fn(() => {
      fetchFn().catch(() => {})
    }),
    stopPolling: vi.fn(),
    togglePolling: vi.fn()
  })
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

  it('does NOT show ElMessageBox.alert when workflow fails', async () => {
    mockWorkflowStore.getWorkflowRun.mockResolvedValue({
      success: true,
      data: {
        id: 10, task_id: 1, status: 'FAILED',
        steps: [{
          step_id: 'step-1', name: '开发实现', status: 'FAILED',
          error: 'Claude Code cannot be launched inside another session.',
          session_id: 1,
          started_at: '2026-04-13T03:04:49.081Z',
          completed_at: '2026-04-13T03:04:51.004Z'
        }],
        context: {}
      }
    })

    mountItem()
    await flushAll()

    expect(ElMessageBox.alert).not.toHaveBeenCalled()
  })

  it('emits node-click with failed node when workflow fails', async () => {
    mockWorkflowStore.getWorkflowRun.mockResolvedValue({
      success: true,
      data: {
        id: 10, task_id: 1, status: 'FAILED',
        steps: [{
          step_id: 'step-1', name: '开发实现', status: 'FAILED',
          error: 'Claude Code error', session_id: 1,
          started_at: '2026-04-13T03:04:49.081Z',
          completed_at: '2026-04-13T03:04:51.004Z'
        }],
        context: {}
      }
    })

    const wrapper = mountItem()
    await flushAll()

    const nodeClicks = wrapper.emitted('workflow-action')
      ?.filter(e => e[0]?.action === 'node-click') || []

    expect(nodeClicks.length).toBeGreaterThanOrEqual(1)
    const emittedNode = nodeClicks[0][0].node
    expect(emittedNode.status).toBe('FAILED')
    expect(emittedNode.name).toBe('开发实现')
  })

  it('does not emit node-click when workflow is RUNNING', async () => {
    mockWorkflowStore.getWorkflowRun.mockResolvedValue({
      success: true,
      data: { id: 10, task_id: 1, status: 'RUNNING', steps: [], context: {} }
    })

    const wrapper = mountItem()
    await flushAll()

    const nodeClicks = wrapper.emitted('workflow-action')
      ?.filter(e => e[0]?.action === 'node-click') || []

    expect(nodeClicks.length).toBe(0)
    expect(ElMessageBox.alert).not.toHaveBeenCalled()
  })
})
