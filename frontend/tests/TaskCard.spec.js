import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TaskCard from '../src/components/TaskCard.vue'

describe('TaskCard', () => {
  const createTask = (overrides = {}) => ({
    id: 1,
    title: 'Test Task',
    description: 'Test description',
    priority: 'MEDIUM',
    status: 'TODO',
    ...overrides
  })

  it('renders task title', () => {
    const task = createTask({ title: 'My Test Task' })
    const wrapper = mount(TaskCard, {
      props: { task }
    })
    expect(wrapper.text()).toContain('My Test Task')
  })

  it('renders truncated description when longer than 100 chars', () => {
    const longDescription = 'A'.repeat(150)
    const task = createTask({ description: longDescription })
    const wrapper = mount(TaskCard, {
      props: { task }
    })
    expect(wrapper.text()).toContain('...')
    expect(wrapper.text()).not.toContain(longDescription)
  })

  it('renders full description when shorter than 100 chars', () => {
    const shortDescription = 'Short desc'
    const task = createTask({ description: shortDescription })
    const wrapper = mount(TaskCard, {
      props: { task }
    })
    expect(wrapper.text()).toContain(shortDescription)
    expect(wrapper.text()).not.toContain('...')
  })

  it('displays correct priority label for CRITICAL', () => {
    const task = createTask({ priority: 'CRITICAL' })
    const wrapper = mount(TaskCard, {
      props: { task }
    })
    expect(wrapper.find('.el-tag').text()).toContain('Crit')
  })

  it('displays correct priority label for HIGH', () => {
    const task = createTask({ priority: 'HIGH' })
    const wrapper = mount(TaskCard, {
      props: { task }
    })
    expect(wrapper.find('.el-tag').text()).toContain('High')
  })

  it('displays correct priority label for MEDIUM', () => {
    const task = createTask({ priority: 'MEDIUM' })
    const wrapper = mount(TaskCard, {
      props: { task }
    })
    expect(wrapper.find('.el-tag').text()).toContain('Med')
  })

  it('displays correct priority label for LOW', () => {
    const task = createTask({ priority: 'LOW' })
    const wrapper = mount(TaskCard, {
      props: { task }
    })
    expect(wrapper.find('.el-tag').text()).toContain('Low')
  })

  it('displays external ID when present', () => {
    const task = createTask({ externalId: 'GHI-123' })
    const wrapper = mount(TaskCard, {
      props: { task }
    })
    expect(wrapper.text()).toContain('#GHI-123')
  })

  it('does not display external ID when absent', () => {
    const task = createTask()
    const wrapper = mount(TaskCard, {
      props: { task }
    })
    expect(wrapper.find('.external-id').exists()).toBe(false)
  })

  it('displays assignee when present', () => {
    const task = createTask({ assignee: 'John Doe' })
    const wrapper = mount(TaskCard, {
      props: { task }
    })
    expect(wrapper.text()).toContain('John Doe')
    expect(wrapper.text()).toContain('J') // Avatar initial
  })

  it('does not display assignee section when absent', () => {
    const task = createTask()
    const wrapper = mount(TaskCard, {
      props: { task }
    })
    expect(wrapper.find('.assignee').exists()).toBe(false)
  })

  it('emits click event when card is clicked', async () => {
    const task = createTask()
    const wrapper = mount(TaskCard, {
      props: { task }
    })
    await wrapper.find('.task-card').trigger('click')
    expect(wrapper.emitted('click')).toBeTruthy()
    expect(wrapper.emitted('click').length).toBe(1)
  })

  it('displays sync time when syncedAt is present', () => {
    const task = createTask({ syncedAt: '2024-01-15T10:30:00' })
    const wrapper = mount(TaskCard, {
      props: { task }
    })
    expect(wrapper.find('.sync-info').exists()).toBe(true)
  })

  it('defaults to MEDIUM priority label when priority is undefined', () => {
    const task = createTask({ priority: undefined })
    const wrapper = mount(TaskCard, {
      props: { task }
    })
    expect(wrapper.find('.el-tag').text()).toContain('Med')
  })
})
