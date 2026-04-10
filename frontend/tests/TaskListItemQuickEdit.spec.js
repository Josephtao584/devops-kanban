import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TaskListItem from '../src/components/task/TaskListItem.vue'
import i18n from '../src/locales'

describe('TaskListItem quick edit', () => {
  const task = {
    id: 1,
    title: 'Test task',
    description: '',
    status: 'TODO',
    priority: 'MEDIUM',
    project_id: 1,
    worktree_status: 'created',
    worktree_path: '/tmp/test',
    source: 'manual',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  }

  it('renders quick edit button when task has worktree', () => {
    const wrapper = mount(TaskListItem, {
      props: { task, selected: false, compact: false, workflowExpanded: true },
      global: { plugins: [i18n] },
    })

    const editBtn = wrapper.find('.quick-action-btn[title="Quick Edit"]')
    expect(editBtn.exists()).toBe(true)
  })

  it('emits quick-edit event when edit button clicked', async () => {
    const wrapper = mount(TaskListItem, {
      props: { task, selected: false, compact: false, workflowExpanded: true },
      global: { plugins: [i18n] },
    })

    const editBtn = wrapper.find('.quick-action-btn[title="Quick Edit"]')
    await editBtn.trigger('click')

    expect(wrapper.emitted('quick-edit')).toBeTruthy()
    expect(wrapper.emitted('quick-edit')[0]).toEqual([task])
  })

  it('disables quick edit button when task has no worktree', () => {
    const taskWithoutWorktree = { ...task, worktree_status: 'none', worktree_path: null }
    const wrapper = mount(TaskListItem, {
      props: { task: taskWithoutWorktree, selected: false, compact: false, workflowExpanded: true },
      global: { plugins: [i18n] },
    })

    const editBtn = wrapper.find('.quick-action-btn[title="Quick Edit"]')
    expect(editBtn.exists()).toBe(true)
    expect(editBtn.attributes('disabled')).toBe('')
  })

  it('does not render standalone commit or diff buttons', () => {
    const wrapper = mount(TaskListItem, {
      props: { task, selected: false, compact: false, workflowExpanded: true },
      global: { plugins: [i18n] },
    })

    const buttons = wrapper.findAll('.quick-action-btn')
    const buttonTexts = buttons.map(b => b.text())
    expect(buttonTexts).not.toContain('提交')
    expect(buttonTexts).not.toContain('差异')
  })
})
