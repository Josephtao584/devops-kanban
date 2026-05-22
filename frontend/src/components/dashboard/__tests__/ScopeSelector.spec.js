import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import ScopeSelector from '../ScopeSelector.vue'

const teams = [{ id: 1, name: 'T1' }, { id: 2, name: 'T2' }]
const projects = [
  { id: 10, name: 'P10', team_id: 1 },
  { id: 11, name: 'P11', team_id: 1 },
  { id: 20, name: 'P20', team_id: 2 },
]

describe('ScopeSelector', () => {
  it('shows all projects when team is "all"', async () => {
    const wrapper = mount(ScopeSelector, {
      props: { teams, projects, modelValue: { teamId: null, projectId: null } },
      global: { mocks: { $t: (k) => k } },
    })
    expect(wrapper.findAll('[data-test="project-option"]').length).toBe(projects.length)
  })

  it('filters projects by selected team', async () => {
    const wrapper = mount(ScopeSelector, {
      props: { teams, projects, modelValue: { teamId: 1, projectId: null } },
      global: { mocks: { $t: (k) => k } },
    })
    expect(wrapper.findAll('[data-test="project-option"]').length).toBe(2)
  })

  it('emits update:modelValue with project=null when team change orphans the project', async () => {
    const wrapper = mount(ScopeSelector, {
      props: { teams, projects, modelValue: { teamId: 1, projectId: 10 } },
      global: { mocks: { $t: (k) => k } },
    })
    await wrapper.vm.onTeamChange(2)
    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    expect(emitted.at(-1)[0]).toEqual({ teamId: 2, projectId: null })
  })
})
