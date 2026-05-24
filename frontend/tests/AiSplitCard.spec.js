import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

const mockProjects = vi.hoisted(() => [
  { id: 1, name: 'Parent Project' },
  { id: 2, name: 'Other Project' },
])

vi.mock('../src/stores/projectStore.js', () => ({
  useProjectStore: () => ({ projects: mockProjects }),
}))

vi.mock('../src/stores/workflowTemplateStore.js', () => ({
  useWorkflowTemplateStore: () => ({
    fetchTemplates: () => Promise.resolve({ success: true, data: [{ template_id: 'tmpl-1', name: 'Tmpl 1' }] }),
  }),
}))

import AiSplitCard from '../src/components/workspace/AiSplitCard.vue'

function makeSuggestion(items = []) {
  return {
    id: 1,
    parent_task_id: 10,
    suggestions: items,
  }
}

function baseItem(overrides = {}) {
  return {
    title: 'child',
    description: '',
    template_id: null,
    linked_project_id: null,
    target_repo_url: null,
    depends_on_indices: [],
    enabled: true,
    create_worktree: true,
    auto_start: true,
    ...overrides,
  }
}

function mountCard(suggestion, parentProjectId = 1) {
  return mount(AiSplitCard, {
    props: { suggestion, parentProjectId, embedded: true },
    global: {
      stubs: {
        'el-select': {
          template: '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><slot /></select>',
          props: ['modelValue', 'placeholder', 'size', 'clearable'],
          emits: ['update:modelValue'],
        },
        'el-option': {
          template: '<option :value="value">{{ label }}</option>',
          props: ['value', 'label'],
        },
        'el-option-group': {
          template: '<optgroup :label="label"><slot /></optgroup>',
          props: ['label'],
        },
        'el-input': {
          template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
          props: ['modelValue', 'size', 'placeholder'],
          emits: ['update:modelValue'],
        },
        'el-button': {
          template: '<button :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
          props: ['disabled', 'type', 'size', 'plain', 'text'],
          emits: ['click'],
        },
        'el-tooltip': {
          template: '<div><slot /></div>',
          props: ['content', 'placement', 'disabled'],
        },
        'el-popconfirm': {
          template: '<div><slot name="reference" /></div>',
          props: ['title', 'confirmButtonText', 'cancelButtonText', 'confirmButtonType', 'width'],
        },
        'el-dialog': {
          template: '<div v-if="modelValue"><slot /></div>',
          props: ['modelValue', 'title', 'width', 'alignCenter'],
        },
      },
    },
  })
}

describe('AiSplitCard', () => {
  it('renders create_worktree and auto_start checkboxes with defaults', () => {
    const wrapper = mountCard(makeSuggestion([baseItem({ template_id: 'tmpl-1' })]))
    const labels = wrapper.findAll('label.switch-pill')
    const createWorktreeLabel = labels.find((l) => l.text().includes('创建 worktree'))
    const autoStartLabel = labels.find((l) => l.text().includes('自动启动'))
    expect(createWorktreeLabel.find('input[type=checkbox]').element.checked).toBe(true)
    expect(autoStartLabel.find('input[type=checkbox]').element.checked).toBe(true)
    expect(autoStartLabel.find('input[type=checkbox]').attributes('disabled')).toBeUndefined()
  })

  it('disables auto_start when no template selected', () => {
    const wrapper = mountCard(makeSuggestion([baseItem({ template_id: null })]))
    const labels = wrapper.findAll('label.switch-pill')
    const autoStartLabel = labels.find((l) => l.text().includes('自动启动'))
    const checkbox = autoStartLabel.find('input[type=checkbox]')
    expect(checkbox.attributes('disabled')).toBeDefined()
    expect(checkbox.element.checked).toBe(false)
  })

  it('forces auto_start=false when template is cleared', async () => {
    const wrapper = mountCard(makeSuggestion([baseItem({ template_id: 'tmpl-1', auto_start: true })]))
    wrapper.vm.updateField(0, 'template_id', null)
    await nextTick()
    const emitted = wrapper.emitted('update')
    const lastPayload = emitted[emitted.length - 1][0]
    expect(lastPayload[0].template_id).toBe(null)
    expect(lastPayload[0].auto_start).toBe(false)
  })

  it('emits target_repo_url when external workspace selected', async () => {
    const wrapper = mountCard(makeSuggestion([baseItem()]))
    wrapper.vm.onWorkspaceSelect(0, '__external__')
    await nextTick()
    const emitted = wrapper.emitted('update')
    const lastPayload = emitted[emitted.length - 1][0]
    expect(lastPayload[0].linked_project_id).toBe(null)
    expect(lastPayload[0].target_repo_url).toBe('')
  })

  it('emits linked_project_id when other Coplat project selected', async () => {
    const wrapper = mountCard(makeSuggestion([baseItem()]))
    wrapper.vm.onWorkspaceSelect(0, 'project:2')
    await nextTick()
    const emitted = wrapper.emitted('update')
    const lastPayload = emitted[emitted.length - 1][0]
    expect(lastPayload[0].linked_project_id).toBe(2)
    expect(lastPayload[0].target_repo_url).toBe(null)
  })

  it('backfills missing flags as defaults on legacy suggestion data', async () => {
    const legacy = baseItem()
    delete legacy.create_worktree
    delete legacy.auto_start
    mountCard(makeSuggestion([legacy]))
    await nextTick()
    // Legacy items default to create_worktree=false (don't surprise users by
    // creating extra worktrees) and auto_start=true (run when a template is
    // chosen).
    expect(legacy.create_worktree).toBe(false)
    expect(legacy.auto_start).toBe(true)
  })

  it('onAddTask creates new item with safe default flags', async () => {
    const wrapper = mountCard(makeSuggestion([]))
    wrapper.vm.onAddTask()
    await nextTick()
    const emitted = wrapper.emitted('update')
    const lastPayload = emitted[emitted.length - 1][0]
    expect(lastPayload[0].create_worktree).toBe(false)
    expect(lastPayload[0].auto_start).toBe(true)
  })
})
