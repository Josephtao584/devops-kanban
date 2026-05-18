import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import WorkflowQuickActions from '../src/components/workspace/WorkflowQuickActions.vue'
import i18n from '../src/locales'

const ElTooltipStub = defineComponent({
  name: 'ElTooltipStub',
  props: { content: { type: String, default: '' }, disabled: { type: Boolean, default: false } },
  setup(_, { slots }) {
    return () => h('div', { class: 'el-tooltip-stub' }, slots.default?.())
  }
})

function mountActions(props = {}) {
  return mount(WorkflowQuickActions, {
    props,
    global: {
      plugins: [i18n],
      stubs: { 'el-tooltip': ElTooltipStub }
    }
  })
}

describe('WorkflowQuickActions loop buttons', () => {
  it('does not render loop-back button by default', () => {
    const wrapper = mountActions()
    expect(wrapper.find('[data-test="loop-back-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="loop-again-btn"]').exists()).toBe(false)
  })

  it('shows loop-back button only when canLoopBack is true', () => {
    const w1 = mountActions({ canLoopBack: true })
    expect(w1.find('[data-test="loop-back-btn"]').exists()).toBe(true)
    const w2 = mountActions({ canLoopBack: false })
    expect(w2.find('[data-test="loop-back-btn"]').exists()).toBe(false)
  })

  it('shows loop-again button only when canLoopAgain is true', () => {
    const w1 = mountActions({ canLoopAgain: true })
    expect(w1.find('[data-test="loop-again-btn"]').exists()).toBe(true)
    const w2 = mountActions({ canLoopAgain: false })
    expect(w2.find('[data-test="loop-again-btn"]').exists()).toBe(false)
  })

  it('emits loop-back event when loop-back button is clicked', async () => {
    const wrapper = mountActions({ canLoopBack: true })
    await wrapper.get('[data-test="loop-back-btn"]').trigger('click')
    expect(wrapper.emitted('loop-back')).toBeTruthy()
    expect(wrapper.emitted('loop-back').length).toBe(1)
  })

  it('emits loop-again event when loop-again button is clicked', async () => {
    const wrapper = mountActions({ canLoopAgain: true })
    await wrapper.get('[data-test="loop-again-btn"]').trigger('click')
    expect(wrapper.emitted('loop-again')).toBeTruthy()
    expect(wrapper.emitted('loop-again').length).toBe(1)
  })
})
