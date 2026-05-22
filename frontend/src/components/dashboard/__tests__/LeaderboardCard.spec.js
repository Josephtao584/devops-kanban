import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import LeaderboardCard from '../LeaderboardCard.vue'

const items = [
  { id: 1, name: 'A1', primary: 12, secondary: '近 5' },
  { id: 2, name: 'A2', primary: 7,  secondary: '近 2' },
]

describe('LeaderboardCard', () => {
  it('renders items in given order with primary and secondary metrics', () => {
    const w = mount(LeaderboardCard, {
      props: { title: 'Top Agents', items },
      global: { mocks: { $t: (k) => k } },
    })
    const rows = w.findAll('[data-test="leaderboard-row"]')
    expect(rows.length).toBe(2)
    expect(rows[0].text()).toContain('A1')
    expect(rows[0].text()).toContain('12')
  })

  it('emits "select" with item id on row click', async () => {
    const w = mount(LeaderboardCard, {
      props: { title: 'Top Agents', items },
      global: { mocks: { $t: (k) => k } },
    })
    await w.findAll('[data-test="leaderboard-row"]')[0].trigger('click')
    expect(w.emitted('select')[0]).toEqual([1])
  })

  it('shows empty placeholder when items is empty', () => {
    const w = mount(LeaderboardCard, {
      props: { title: 'Top Agents', items: [] },
      global: { mocks: { $t: (k) => k } },
    })
    expect(w.text()).toContain('dashboard.empty')
  })
})
