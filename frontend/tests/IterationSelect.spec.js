import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import IterationSelect from '../src/components/iteration/IterationSelect.vue'
import i18n from '../src/locales'

const mockIterations = [
  { id: 1, name: 'Sprint 1', status: 'ACTIVE' },
  { id: 2, name: 'Sprint 2', status: 'PLANNED' },
  { id: 3, name: 'Sprint 3', status: 'COMPLETED' }
]

function mountComponent(props = {}) {
  return mount(IterationSelect, {
    props: {
      iterations: mockIterations,
      ...props
    },
    global: {
      plugins: [i18n]
    }
  })
}

describe('IterationSelect', () => {
  it('renders all iterations plus "all" option with __ALL__ value', () => {
    const wrapper = mountComponent()
    const options = wrapper.findAllComponents({ name: 'ElOption' })
    // 3 iterations + 1 "all" option
    expect(options).toHaveLength(4)
    // First option is "all iterations"
    expect(options[0].props('value')).toBe('__ALL__')
  })

  it('converts null modelValue to __ALL__ internally', async () => {
    const wrapper = mountComponent({ modelValue: null })
    await nextTick()
    // The internal computed should return '__ALL__' for null
    const vm = wrapper.vm
    expect(vm.selectedIteration).toBe('__ALL__')
  })

  it('converts string numeric modelValue to Number', async () => {
    const wrapper = mountComponent({ modelValue: '2' })
    await nextTick()
    expect(wrapper.vm.selectedIteration).toBe(2)
  })

  it('keeps numeric modelValue as-is', async () => {
    const wrapper = mountComponent({ modelValue: 1 })
    await nextTick()
    expect(wrapper.vm.selectedIteration).toBe(1)
  })

  it('emits null when __ALL__ is selected', async () => {
    const wrapper = mountComponent({ modelValue: 1 })
    await nextTick()

    // Simulate setting to __ALL__
    wrapper.vm.selectedIteration = '__ALL__'
    await nextTick()

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')[0]).toEqual([null])
  })

  it('emits iteration id when a real iteration is selected', async () => {
    const wrapper = mountComponent({ modelValue: null })
    await nextTick()

    wrapper.vm.selectedIteration = 2
    await nextTick()

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')[0]).toEqual([2])
  })

  it('is disabled when disabled prop is true', () => {
    const wrapper = mountComponent({ disabled: true })
    const select = wrapper.findComponent({ name: 'ElSelect' })
    expect(select.props('disabled')).toBe(true)
  })
})
