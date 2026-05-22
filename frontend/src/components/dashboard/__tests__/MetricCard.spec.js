import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import MetricCard from '../MetricCard.vue'

describe('MetricCard', () => {
  it('renders title, recent and total values', () => {
    const w = mount(MetricCard, {
      props: { title: 'Sessions', recent: 12, total: 145 },
      global: { mocks: { $t: (k) => k } },
    })
    expect(w.text()).toContain('Sessions')
    expect(w.text()).toContain('12')
    expect(w.text()).toContain('145')
  })

  it('emits click when card is clickable', async () => {
    const w = mount(MetricCard, {
      props: { title: 'Sessions', recent: 1, total: 2, clickable: true },
      global: { mocks: { $t: (k) => k } },
    })
    await w.find('[data-test="metric-card"]').trigger('click')
    expect(w.emitted('click')).toBeTruthy()
  })
})
