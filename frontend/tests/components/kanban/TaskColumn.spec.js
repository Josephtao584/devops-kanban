import { describe, expect, it, vi } from 'vitest'
import { mount, shallowMount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

import TaskColumn from '../../../src/components/kanban/TaskColumn.vue'

// vuedraggable stub — renders #item slot for each element in :list
const DraggableStub = defineComponent({
  name: 'Draggable',
  props: {
    list: { type: Array, default: () => [] }
  },
  emits: ['end'],
  setup(props, { slots, emit }) {
    return () => h('div', { class: 'draggable-stub' }, [
      props.list.map((element, index) =>
        slots.item ? slots.item({ element, index }) : null
      ),
      // Expose a button to trigger @end for testing
      h('button', {
        class: 'drag-end-trigger',
        onClick: () => emit('end', { oldIndex: 0, newIndex: 1 })
      }, 'trigger drag-end')
    ])
  }
})

// TaskListItem stub — renders task title and emits events
const TaskListItemStub = defineComponent({
  name: 'TaskListItem',
  props: {
    task: { type: Object, required: true },
    selected: { type: Boolean, default: false },
    running: { type: Boolean, default: false }
  },
  emits: ['click', 'edit', 'delete', 'worktree-update', 'toggle-workflow', 'toggle-description', 'workflow-action', 'quick-edit'],
  setup(props, { emit }) {
    return () => h('div', {
      class: 'task-list-item-stub',
      'data-task-id': props.task?.id,
      onClick: () => emit('click', props.task)
    }, [
      h('span', { class: 'task-title-stub' }, props.task?.title || 'Untitled'),
      h('button', { class: 'stub-edit', onClick: () => emit('edit', props.task) }, 'edit'),
      h('button', { class: 'stub-delete', onClick: () => emit('delete', props.task?.id) }, 'delete'),
      h('button', { class: 'stub-worktree', onClick: () => emit('worktree-update', props.task) }, 'worktree'),
      h('button', { class: 'stub-toggle-workflow', onClick: () => emit('toggle-workflow', props.task?.id) }, 'toggle-workflow'),
      h('button', { class: 'stub-toggle-description', onClick: () => emit('toggle-description', props.task?.id) }, 'toggle-description'),
      h('button', { class: 'stub-workflow-action', onClick: () => emit('workflow-action', { action: 'test', task: props.task }) }, 'workflow-action'),
      h('button', { class: 'stub-quick-edit', onClick: () => emit('quick-edit', props.task) }, 'quick-edit')
    ])
  }
})

const mountTaskColumn = (props = {}, options = {}) => {
  const defaultProps = {
    status: 'TODO',
    title: '待办',
    tasks: [],
    emptyText: '暂无任务',
    showAddButton: false,
    showSyncButton: false,
    selectedTask: null,
    runningTaskIds: new Set(),
    expandedTaskId: null,
    expandedDescriptionTaskId: null,
    currentNodeId: null,
    ...props
  }

  return mount(TaskColumn, {
    global: {
      stubs: {
        draggable: DraggableStub,
        TaskListItem: TaskListItemStub
      },
      mocks: {
        $t: (key, fallback) => fallback || key
      }
    },
    props: defaultProps,
    ...options
  })
}

describe('TaskColumn', () => {
  it('renders column with title and task count', () => {
    const wrapper = mountTaskColumn({
      title: '进行中',
      tasks: [{ id: 1, title: 'Task A' }, { id: 2, title: 'Task B' }]
    })

    expect(wrapper.find('.column-title').text()).toBe('进行中')
    expect(wrapper.find('.column-count').text()).toBe('2')
  })

  it('renders status indicator with correct class', () => {
    const wrapper = mountTaskColumn({ status: 'IN_PROGRESS' })
    expect(wrapper.find('.column-status').classes()).toContain('status-in_progress-dot')
  })

  it('uses statusClass prop when provided', () => {
    const wrapper = mountTaskColumn({ status: 'TODO', statusClass: 'custom' })
    expect(wrapper.find('.column-status').classes()).toContain('status-custom-dot')
  })

  it('shows empty state when no tasks', () => {
    const wrapper = mountTaskColumn({ tasks: [], emptyText: '拖拽任务到这里' })
    expect(wrapper.find('.empty-column p').text()).toBe('拖拽任务到这里')
  })

  it('renders TaskListItem for each task', () => {
    const wrapper = mountTaskColumn({
      tasks: [
        { id: 1, title: 'Task A' },
        { id: 2, title: 'Task B' },
        { id: 3, title: 'Task C' }
      ]
    })

    expect(wrapper.findAll('.task-list-item-stub')).toHaveLength(3)
    expect(wrapper.findAll('.task-title-stub').map((el) => el.text())).toEqual(['Task A', 'Task B', 'Task C'])
  })

  it('shows add button when showAddButton=true', () => {
    const wrapper = mountTaskColumn({ showAddButton: true })
    expect(wrapper.find('.add-task-btn').exists()).toBe(true)
  })

  it('hides add button when showAddButton=false', () => {
    const wrapper = mountTaskColumn({ showAddButton: false })
    expect(wrapper.find('.add-task-btn').exists()).toBe(false)
  })

  it('shows sync button when showSyncButton=true', () => {
    const wrapper = mountTaskColumn({ showSyncButton: true })
    expect(wrapper.find('.sync-btn').exists()).toBe(true)
  })

  it('hides sync button when showSyncButton=false', () => {
    const wrapper = mountTaskColumn({ showSyncButton: false })
    expect(wrapper.find('.sync-btn').exists()).toBe(false)
  })

  it('emits add-task when add button clicked', async () => {
    const wrapper = mountTaskColumn({ showAddButton: true })
    await wrapper.find('.add-task-btn').trigger('click')
    expect(wrapper.emitted('add-task')).toHaveLength(1)
  })

  it('emits sync when sync button clicked', async () => {
    const wrapper = mountTaskColumn({ showSyncButton: true })
    await wrapper.find('.sync-btn').trigger('click')
    expect(wrapper.emitted('sync')).toHaveLength(1)
  })

  it('emits drag-end when drag reorder happens', async () => {
    const wrapper = mountTaskColumn({
      tasks: [{ id: 1, title: 'Task A' }]
    })

    // The DraggableStub exposes a button to trigger the @end event
    await wrapper.find('.drag-end-trigger').trigger('click')
    expect(wrapper.emitted('drag-end')).toHaveLength(1)
    expect(wrapper.emitted('drag-end')[0][0]).toMatchObject({ oldIndex: 0, newIndex: 1 })
  })

  it('passes through select-task from TaskListItem', async () => {
    const task = { id: 5, title: 'Select Me' }
    const wrapper = mountTaskColumn({ tasks: [task] })

    await wrapper.find('.task-list-item-stub').trigger('click')
    const emitted = wrapper.emitted('select-task')
    expect(emitted).toHaveLength(1)
    expect(emitted[0][0]).toEqual(task)
  })

  it('passes through edit-task from TaskListItem', async () => {
    const task = { id: 5, title: 'Edit Me' }
    const wrapper = mountTaskColumn({ tasks: [task] })

    await wrapper.find('.stub-edit').trigger('click')
    const emitted = wrapper.emitted('edit-task')
    expect(emitted).toHaveLength(1)
    expect(emitted[0][0]).toEqual(task)
  })

  it('passes through delete-task from TaskListItem', async () => {
    const wrapper = mountTaskColumn({
      tasks: [{ id: 7, title: 'Delete Me' }]
    })

    await wrapper.find('.stub-delete').trigger('click')
    const emitted = wrapper.emitted('delete-task')
    expect(emitted).toHaveLength(1)
    expect(emitted[0][0]).toBe(7)
  })

  it('passes through worktree-update from TaskListItem', async () => {
    const task = { id: 3, title: 'Worktree Task', worktree_status: 'created' }
    const wrapper = mountTaskColumn({ tasks: [task] })

    await wrapper.find('.stub-worktree').trigger('click')
    const emitted = wrapper.emitted('worktree-update')
    expect(emitted).toHaveLength(1)
    expect(emitted[0][0]).toEqual(task)
  })

  it('passes through toggle-workflow from TaskListItem', async () => {
    const wrapper = mountTaskColumn({
      tasks: [{ id: 4, title: 'Workflow Task' }]
    })

    await wrapper.find('.stub-toggle-workflow').trigger('click')
    const emitted = wrapper.emitted('toggle-workflow')
    expect(emitted).toHaveLength(1)
    expect(emitted[0][0]).toBe(4)
  })

  it('passes through toggle-description from TaskListItem', async () => {
    const wrapper = mountTaskColumn({
      tasks: [{ id: 4, title: 'Description Task' }]
    })

    await wrapper.find('.stub-toggle-description').trigger('click')
    const emitted = wrapper.emitted('toggle-description')
    expect(emitted).toHaveLength(1)
    expect(emitted[0][0]).toBe(4)
  })

  it('passes through workflow-action from TaskListItem', async () => {
    const task = { id: 6, title: 'Action Task' }
    const wrapper = mountTaskColumn({ tasks: [task] })

    await wrapper.find('.stub-workflow-action').trigger('click')
    const emitted = wrapper.emitted('workflow-action')
    expect(emitted).toHaveLength(1)
    expect(emitted[0][0]).toMatchObject({ action: 'test', task })
  })

  it('passes through quick-edit from TaskListItem', async () => {
    const task = { id: 8, title: 'Quick Edit Task' }
    const wrapper = mountTaskColumn({ tasks: [task] })

    await wrapper.find('.stub-quick-edit').trigger('click')
    const emitted = wrapper.emitted('quick-edit')
    expect(emitted).toHaveLength(1)
    expect(emitted[0][0]).toEqual(task)
  })

  it('isTaskRunning returns true for running task ids', () => {
    const runningTaskIds = new Set([1, 3, 5])
    const wrapper = mountTaskColumn({
      tasks: [
        { id: 1, title: 'Running' },
        { id: 2, title: 'Not Running' },
        { id: 3, title: 'Also Running' }
      ],
      runningTaskIds
    })

    const items = wrapper.findAll('.task-list-item-stub')
    // The running prop is passed to TaskListItemStub — check via wrapper VM method
    expect(wrapper.vm.isTaskRunning(1)).toBe(true)
    expect(wrapper.vm.isTaskRunning(2)).toBe(false)
    expect(wrapper.vm.isTaskRunning(3)).toBe(true)
    expect(wrapper.vm.isTaskRunning(99)).toBe(false)
  })

  it('formatTaskElapsedTime returns empty string', () => {
    const wrapper = mountTaskColumn({ tasks: [] })
    expect(wrapper.vm.formatTaskElapsedTime(1)).toBe('')
  })

  it('column header has data-status attribute', () => {
    const wrapper = mountTaskColumn({ status: 'DONE' })
    expect(wrapper.find('.kanban-column').attributes('data-status')).toBe('DONE')
  })

  it('draggable has data-status attribute', () => {
    const wrapper = mountTaskColumn({ status: 'IN_PROGRESS', tasks: [{ id: 1, title: 'T' }] })
    expect(wrapper.find('.draggable-stub').attributes('data-status')).toBe('IN_PROGRESS')
  })
})
