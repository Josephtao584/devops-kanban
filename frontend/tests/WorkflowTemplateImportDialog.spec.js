import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'

import i18n from '../src/locales'
import WorkflowTemplateImportDialog from '../src/components/workflow/WorkflowTemplateImportDialog.vue'
import { previewImportWorkflowTemplates, confirmImportWorkflowTemplates } from '../src/api/workflowTemplate.js'

vi.mock('../src/api/workflowTemplate.js', () => ({
  previewImportWorkflowTemplates: vi.fn(),
  confirmImportWorkflowTemplates: vi.fn()
}))

const BaseDialogStub = defineComponent({
  name: 'BaseDialogStub',
  props: {
    modelValue: { type: Boolean, default: false },
    title: { type: String, default: '' },
    width: { type: String, default: '' }
  },
  emits: ['close'],
  setup(props, { slots, emit }) {
    return () => props.modelValue ? h('div', { class: 'base-dialog-stub' }, [
      h('div', { class: 'dialog-title-stub' }, props.title),
      slots.default?.(),
      h('div', { class: 'dialog-footer-stub' }, slots.footer?.())
    ]) : null
  }
})

function createWrapper(props = {}) {
  return mount(WorkflowTemplateImportDialog, {
    props: {
      modelValue: true,
      agents: [
        { id: 1, name: 'Agent A', enabled: true },
        { id: 2, name: 'Agent B', enabled: true }
      ],
      ...props
    },
    global: {
      plugins: [i18n],
      stubs: {
        BaseDialog: BaseDialogStub,
        ElIcon: true,
        ElButton: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
        ElTag: { template: '<span><slot /></span>' },
        ElRadioGroup: { template: '<div><slot /></div>' },
        ElRadio: { template: '<label><slot /></label>' },
        ElSelect: { template: '<select><slot /></select>' },
        ElOption: { template: '<option><slot /></option>' }
      }
    }
  })
}

async function simulateFileUpload(wrapper, jsonData) {
  const file = new File([JSON.stringify(jsonData)], 'test.json', { type: 'application/json' })
  const input = wrapper.find('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: [file] })
  await input.trigger('change')
  await nextTick()
}

describe('WorkflowTemplateImportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders upload step initially', () => {
    const wrapper = createWrapper()
    expect(wrapper.find('.upload-zone').exists()).toBe(true)
  })

  it('parses a valid JSON file and calls preview API', async () => {
    const mockPreviewResult = {
      success: true,
      data: {
        templates: [{ template_id: 'test', name: 'Test', steps: [{ id: 's1', name: 'S1', instructionPrompt: 'Do', agentName: 'Agent A' }] }],
        existingTemplateIds: [],
        unmatchedAgentNames: []
      }
    }
    previewImportWorkflowTemplates.mockResolvedValue(mockPreviewResult)

    const wrapper = createWrapper()
    await simulateFileUpload(wrapper, {
      version: '1.0',
      exportedAt: '2026-04-13T00:00:00Z',
      templates: [{ template_id: 'test', name: 'Test', steps: [{ id: 's1', name: 'S1', instructionPrompt: 'Do', agentName: 'Agent A' }] }]
    })

    expect(previewImportWorkflowTemplates).toHaveBeenCalledWith(
      expect.objectContaining({
        version: '1.0',
        templates: expect.arrayContaining([
          expect.objectContaining({ template_id: 'test' })
        ])
      })
    )
  })

  it('shows preview table after successful preview', async () => {
    previewImportWorkflowTemplates.mockResolvedValue({
      success: true,
      data: {
        templates: [{ template_id: 'test', name: 'Test', steps: [{ id: 's1', name: 'S1', instructionPrompt: 'Do', agentName: 'Agent A' }] }],
        existingTemplateIds: [],
        unmatchedAgentNames: []
      }
    })

    const wrapper = createWrapper()
    await simulateFileUpload(wrapper, {
      version: '1.0',
      exportedAt: '2026-04-13T00:00:00Z',
      templates: [{ template_id: 'test', name: 'Test', steps: [{ id: 's1', name: 'S1', instructionPrompt: 'Do', agentName: 'Agent A' }] }]
    })

    expect(wrapper.find('.preview-table').exists()).toBe(true)
    expect(wrapper.find('.preview-template-name').text()).toBe('Test')
  })

  it('shows conflict section when templates exist', async () => {
    previewImportWorkflowTemplates.mockResolvedValue({
      success: true,
      data: {
        templates: [{ template_id: 'existing', name: 'Existing', steps: [] }],
        existingTemplateIds: ['existing'],
        unmatchedAgentNames: []
      }
    })

    const wrapper = createWrapper()
    await simulateFileUpload(wrapper, {
      version: '1.0',
      templates: [{ template_id: 'existing', name: 'Existing', steps: [] }]
    })

    expect(wrapper.find('.import-section').exists()).toBe(true)
    const metaSpans = wrapper.findAll('.preview-template-meta span')
    const conflictTag = metaSpans.find(s => s.text().includes('已存在'))
    expect(conflictTag).toBeTruthy()
  })

  it('shows agent mapping section when agents are unmatched', async () => {
    previewImportWorkflowTemplates.mockResolvedValue({
      success: true,
      data: {
        templates: [{ template_id: 'new', name: 'New', steps: [{ id: 's1', name: 'S1', instructionPrompt: 'Do', agentName: 'Unknown Agent' }] }],
        existingTemplateIds: [],
        unmatchedAgentNames: ['Unknown Agent']
      }
    })

    const wrapper = createWrapper()
    await simulateFileUpload(wrapper, {
      version: '1.0',
      templates: [{ template_id: 'new', name: 'New', steps: [{ id: 's1', name: 'S1', instructionPrompt: 'Do', agentName: 'Unknown Agent' }] }]
    })

    expect(wrapper.find('.agent-mapping-row').exists()).toBe(true)
    expect(wrapper.find('.agent-mapping-source').text()).toBe('Unknown Agent')
  })

  it('calls confirmImport on confirm button click', async () => {
    previewImportWorkflowTemplates.mockResolvedValue({
      success: true,
      data: {
        templates: [{ template_id: 'new', name: 'New', steps: [{ id: 's1', name: 'S1', instructionPrompt: 'Do', agentName: 'Agent A' }] }],
        existingTemplateIds: [],
        unmatchedAgentNames: []
      }
    })

    confirmImportWorkflowTemplates.mockResolvedValue({
      success: true,
      data: {
        imported: [{ template_id: 'new', name: 'New', steps: [] }],
        skipped: []
      }
    })

    const wrapper = createWrapper()
    await simulateFileUpload(wrapper, {
      version: '1.0',
      templates: [{ template_id: 'new', name: 'New', steps: [{ id: 's1', name: 'S1', instructionPrompt: 'Do', agentName: 'Agent A' }] }]
    })

    await wrapper.vm.handleConfirmImport()
    await nextTick()

    expect(confirmImportWorkflowTemplates).toHaveBeenCalledWith(
      expect.objectContaining({
        strategy: 'copy',
        templates: expect.any(Array),
        agentMappings: expect.any(Object)
      })
    )
  })

  it('emits imported event and shows result after successful import', async () => {
    previewImportWorkflowTemplates.mockResolvedValue({
      success: true,
      data: {
        templates: [{ template_id: 'new', name: 'New', steps: [{ id: 's1', name: 'S1', instructionPrompt: 'Do', agentName: 'Agent A' }] }],
        existingTemplateIds: [],
        unmatchedAgentNames: []
      }
    })

    confirmImportWorkflowTemplates.mockResolvedValue({
      success: true,
      data: {
        imported: [{ template_id: 'new', name: 'New', steps: [] }],
        skipped: []
      }
    })

    const wrapper = createWrapper()
    await simulateFileUpload(wrapper, {
      version: '1.0',
      templates: [{ template_id: 'new', name: 'New', steps: [{ id: 's1', name: 'S1', instructionPrompt: 'Do', agentName: 'Agent A' }] }]
    })

    await wrapper.vm.handleConfirmImport()
    await nextTick()

    expect(wrapper.emitted('imported')).toBeTruthy()
    expect(wrapper.find('.import-result-summary').exists()).toBe(true)
  })

  it('resets state on close', async () => {
    previewImportWorkflowTemplates.mockResolvedValue({
      success: true,
      data: {
        templates: [{ template_id: 'test', name: 'Test', steps: [] }],
        existingTemplateIds: [],
        unmatchedAgentNames: []
      }
    })

    const wrapper = createWrapper()
    await simulateFileUpload(wrapper, {
      version: '1.0',
      templates: [{ template_id: 'test', name: 'Test', steps: [] }]
    })

    expect(wrapper.find('.preview-table').exists()).toBe(true)

    await wrapper.vm.handleClose()
    await nextTick()

    expect(wrapper.find('.upload-zone').exists()).toBe(true)
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
  })
})
