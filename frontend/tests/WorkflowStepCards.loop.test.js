import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import WorkflowStepCards from '../src/components/workspace/WorkflowStepCards.vue'
import i18n from '../src/locales'

const ElTooltipStub = defineComponent({
  name: 'ElTooltipStub',
  props: { content: { type: String, default: '' }, placement: { type: String, default: 'top' } },
  setup(props, { slots }) {
    return () => h('span', { class: 'el-tooltip-stub', 'data-content': props.content }, slots.default?.())
  }
})

function makeRuns() {
  return [
    {
      id: 1,
      iteration: 1,
      parent_run_id: null,
      looped_from_step_id: null,
      loop_failure_context: null,
      steps: [
        { step_id: 's1', name: '步骤一', status: 'COMPLETED', inherited_from_run_id: null },
        { step_id: 's2', name: '步骤二', status: 'FAILED', inherited_from_run_id: null, error: 'boom' }
      ]
    },
    {
      id: 2,
      iteration: 2,
      parent_run_id: 1,
      looped_from_step_id: 's1',
      loop_failure_context: { failed_step_id: 's2', error: 'boom', summary: null },
      steps: [
        { step_id: 's1', name: '步骤一', status: 'SKIPPED', inherited_from_run_id: 1 },
        { step_id: 's2', name: '步骤二', status: 'RUNNING', inherited_from_run_id: null }
      ]
    }
  ]
}

function mountCards(props = {}) {
  return mount(WorkflowStepCards, {
    props,
    global: {
      plugins: [i18n],
      stubs: { 'el-tooltip': ElTooltipStub }
    }
  })
}

describe('WorkflowStepCards loop rendering', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('hides SKIPPED steps from the unified timeline', () => {
    const wrapper = mountCards({ runs: makeRuns() })
    // Expected step cards: run1.s1, run1.s2, run2.s2 (run2.s1 SKIPPED → hidden)
    expect(wrapper.findAll('[data-test="step-card"]')).toHaveLength(3)
  })

  it('renders a separator between runs', () => {
    const wrapper = mountCards({ runs: makeRuns() })
    const separators = wrapper.findAll('[data-test="run-separator"]')
    expect(separators).toHaveLength(1)
    // Separator should mention the loop-from step name and failed step name
    expect(separators[0].text()).toContain('步骤一')
    expect(separators[0].text()).toContain('步骤二')
  })

  it('renders no separator for a single run', () => {
    const runs = [makeRuns()[0]]
    const wrapper = mountCards({ runs })
    expect(wrapper.findAll('[data-test="run-separator"]')).toHaveLength(0)
    expect(wrapper.findAll('[data-test="step-card"]')).toHaveLength(2)
  })

  it('falls back to legacy steps prop when runs is empty', () => {
    const steps = [
      { id: 'a', step_id: 'a', name: 'A', statusClass: 'done', statusLabel: '已完成', status: 'COMPLETED' },
      { id: 'b', step_id: 'b', name: 'B', statusClass: 'pending', statusLabel: '待执行', status: 'PENDING' }
    ]
    const wrapper = mountCards({ steps })
    expect(wrapper.findAll('[data-test="step-card"]')).toHaveLength(2)
    expect(wrapper.findAll('[data-test="run-separator"]')).toHaveLength(0)
  })
})
