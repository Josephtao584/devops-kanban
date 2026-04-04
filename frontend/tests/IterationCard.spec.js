import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import IterationCard from '../src/components/iteration/IterationCard.vue'
import i18n from '../src/locales'

function mountCard(iteration = {}) {
  return mount(IterationCard, {
    props: {
      iteration: {
        id: 1,
        name: 'Sprint 1',
        status: 'ACTIVE',
        description: 'First sprint',
        task_count: 10,
        done_count: 4,
        ...iteration
      }
    },
    global: {
      plugins: [i18n],
      stubs: {
        'el-card': {
          template: '<div class="el-card" @click="$emit(\'click\')"><slot name="header" /><slot /><slot name="footer" /></div>',
          emits: ['click']
        },
        'el-tag': {
          template: '<span class="el-tag"><slot /></span>',
          props: ['type', 'size']
        },
        'el-progress': {
          template: '<div class="el-progress" />',
          props: ['percentage', 'status']
        },
        'el-button': {
          template: '<button class="el-button" @click="$emit(\'click\')"><slot /></button>',
          emits: ['click']
        },
        'el-icon': {
          template: '<span class="el-icon"><slot /></span>',
          props: ['size']
        },
        Timer: { template: '<span />' },
        Calendar: { template: '<span />' },
        Edit: { template: '<span>edit</span>' },
        Delete: { template: '<span>delete</span>' }
      }
    }
  })
}

describe('IterationCard', () => {
  it('renders iteration name', () => {
    const wrapper = mountCard({ name: 'Sprint Alpha' })
    expect(wrapper.text()).toContain('Sprint Alpha')
  })

  it('renders description', () => {
    const wrapper = mountCard({ description: 'Important sprint' })
    expect(wrapper.text()).toContain('Important sprint')
  })

  it('shows no description fallback when empty', () => {
    const wrapper = mountCard({ description: '' })
    expect(wrapper.text()).toContain('暂无描述')
  })

  it('computes progress correctly', () => {
    const wrapper = mountCard({ task_count: 10, done_count: 4 })
    expect(wrapper.vm.progress).toBe(40)
  })

  it('handles zero task_count', () => {
    const wrapper = mountCard({ task_count: 0, done_count: 0 })
    expect(wrapper.vm.progress).toBe(0)
  })

  it('handles missing task_count', () => {
    const wrapper = mountCard({ task_count: undefined, done_count: undefined })
    expect(wrapper.vm.progress).toBe(0)
  })

  it('returns correct statusType for each status', () => {
    const cases = [
      { status: 'PLANNED', type: 'info' },
      { status: 'ACTIVE', type: 'warning' },
      { status: 'COMPLETED', type: 'success' },
      { status: 'ARCHIVED', type: 'info' }
    ]
    for (const { status, type } of cases) {
      const wrapper = mountCard({ status })
      expect(wrapper.vm.statusType).toBe(type)
    }
  })

  it('returns correct statusLabel for each status', () => {
    const cases = [
      { status: 'PLANNED', label: '计划中' },
      { status: 'ACTIVE', label: '进行中' },
      { status: 'COMPLETED', label: '已完成' },
      { status: 'ARCHIVED', label: '已归档' }
    ]
    for (const { status, label } of cases) {
      const wrapper = mountCard({ status })
      expect(wrapper.vm.statusLabel).toBe(label)
    }
  })

  it('defaults to PLANNED when no status', () => {
    const wrapper = mountCard({ status: undefined })
    expect(wrapper.vm.statusType).toBe('info')
    expect(wrapper.vm.statusLabel).toBe('计划中')
  })

  it('returns success progressStatus for COMPLETED', () => {
    const wrapper = mountCard({ status: 'COMPLETED' })
    expect(wrapper.vm.progressStatus).toBe('success')
  })

  it('returns empty progressStatus for ARCHIVED', () => {
    const wrapper = mountCard({ status: 'ARCHIVED' })
    expect(wrapper.vm.progressStatus).toBe('')
  })

  it('returns success progressStatus when progress is 100', () => {
    const wrapper = mountCard({ status: 'ACTIVE', task_count: 10, done_count: 10 })
    expect(wrapper.vm.progressStatus).toBe('success')
  })

  it('returns empty progressStatus for incomplete active', () => {
    const wrapper = mountCard({ status: 'ACTIVE', task_count: 10, done_count: 5 })
    expect(wrapper.vm.progressStatus).toBe('')
  })

  it('formats dates correctly', () => {
    const wrapper = mountCard()
    const formatted = wrapper.vm.formatDate('2025-01-15')
    // Should produce a localized date string containing year/month/day components
    expect(formatted).toMatch(/2025/)
    expect(formatted).not.toBe('2025-01-15') // should be localized, not raw
  })

  it('returns empty string for null date', () => {
    const wrapper = mountCard()
    expect(wrapper.vm.formatDate(null)).toBe('')
  })

  it('emits click on card click', () => {
    const wrapper = mountCard()
    wrapper.find('.el-card').trigger('click')
    expect(wrapper.emitted('click')).toBeTruthy()
  })

  it('renders edit and delete action buttons', () => {
    const wrapper = mountCard()
    const buttons = wrapper.findAll('.el-button')
    expect(buttons.length).toBeGreaterThanOrEqual(2)
  })
})
