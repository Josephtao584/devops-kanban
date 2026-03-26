import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import i18n from '../src/locales'
import IterationCard from '../src/components/iteration/IterationCard.vue'

describe('IterationCard', () => {
  const createIteration = (overrides = {}) => ({
    id: 1,
    name: 'Sprint 1',
    description: 'First sprint',
    status: 'PLANNED',
    task_count: 0,
    done_count: 0,
    ...overrides
  })

  it('renders edit and delete action buttons', () => {
    const wrapper = mount(IterationCard, {
      props: {
        iteration: createIteration()
      },
      global: {
        plugins: [i18n]
      }
    })

    const buttons = wrapper.findAll('button')
    expect(buttons.length).toBeGreaterThanOrEqual(2)
  })
})
