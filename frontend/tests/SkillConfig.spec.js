import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import SkillConfig from '../src/views/SkillConfig.vue'
import i18n from '../src/locales'

const mockSkillStore = vi.hoisted(() => ({
  skills: [],
  loading: false,
  error: null,
  currentSkill: null,
  fetchSkills: vi.fn(),
  fetchSkill: vi.fn(),
  createSkill: vi.fn(),
  updateSkill: vi.fn(),
  deleteSkill: vi.fn(),
  setCurrentSkill: vi.fn(),
  clearSkills: vi.fn(),
  clearError: vi.fn(),
  fetchSkillFiles: vi.fn(),
  fetchSkillFile: vi.fn(),
  updateSkillFile: vi.fn(),
  uploadSkillZip: vi.fn()
}))

vi.mock('../src/stores/skillStore', () => ({
  useSkillStore: () => mockSkillStore
}))

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await nextTick()
}

describe('SkillConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSkillStore.skills = []
    mockSkillStore.loading = false
    mockSkillStore.error = null
    mockSkillStore.currentSkill = null
    mockSkillStore.fetchSkills.mockResolvedValue({ success: true, data: [] })
    mockSkillStore.fetchSkillFiles.mockResolvedValue([])
    mockSkillStore.fetchSkillFile.mockResolvedValue({ path: 'SKILL.md', content: '# Skill' })
    mockSkillStore.updateSkillFile.mockResolvedValue(undefined)
    mockSkillStore.uploadSkillZip.mockResolvedValue(undefined)
    mockSkillStore.createSkill.mockResolvedValue({ success: true, data: { id: 3, name: 'new-skill' } })
    mockSkillStore.updateSkill.mockResolvedValue({ success: true, data: { id: 1, name: 'brainstorming' } })
    mockSkillStore.deleteSkill.mockResolvedValue({ success: true })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  function mountView() {
    return mount(SkillConfig, {
      global: {
        plugins: [i18n]
      }
    })
  }

  it('loads skills and auto-selects the first skill', async () => {
    mockSkillStore.skills = [
      { id: 1, name: 'brainstorming', description: 'desc', created_at: '2026-03-28', updated_at: '2026-03-28' }
    ]
    mockSkillStore.fetchSkillFiles.mockResolvedValue(['SKILL.md'])

    const wrapper = mountView()
    await flushPromises()

    expect(mockSkillStore.fetchSkills).toHaveBeenCalledTimes(1)
    expect(mockSkillStore.fetchSkillFiles).toHaveBeenCalledWith(1)
    expect(wrapper.text()).toContain('brainstorming')
    expect(wrapper.text()).toContain('SKILL.md')
  })

  it('loads file preview when selecting a file', async () => {
    mockSkillStore.skills = [
      { id: 1, name: 'brainstorming', description: 'desc', created_at: '2026-03-28', updated_at: '2026-03-28' }
    ]
    mockSkillStore.fetchSkillFiles.mockResolvedValue(['SKILL.md'])
    mockSkillStore.fetchSkillFile.mockResolvedValue({ path: 'SKILL.md', content: '# Skill Content' })

    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('.el-tree-node__content').trigger('click')
    await flushPromises()

    expect(mockSkillStore.fetchSkillFile).toHaveBeenCalledWith(1, 'SKILL.md')
    expect(wrapper.find('.preview-code').text()).toContain('# Skill Content')
  })

  it('creates a skill from the modal form', async () => {
    mockSkillStore.skills = []

    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-testid="open-create-skill"]').trigger('click')
    await wrapper.get('[data-testid="skill-name-input"]').setValue('new-skill')
    await wrapper.get('[data-testid="skill-description-input"]').setValue('new skill desc')
    await wrapper.get('[data-testid="skill-form"]').trigger('submit')
    await flushPromises()

    expect(mockSkillStore.createSkill).toHaveBeenCalledWith({
      name: 'new-skill',
      description: 'new skill desc'
    })
    expect(mockSkillStore.fetchSkills).toHaveBeenCalledTimes(2)
  })

  it('saves edited file content', async () => {
    mockSkillStore.skills = [
      { id: 1, name: 'brainstorming', description: 'desc', created_at: '2026-03-28', updated_at: '2026-03-28' }
    ]
    mockSkillStore.fetchSkillFiles.mockResolvedValue(['SKILL.md'])
    mockSkillStore.fetchSkillFile.mockResolvedValue({ path: 'SKILL.md', content: '# Old Content' })

    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('.el-tree-node__content').trigger('click')
    await flushPromises()
    await wrapper.find('.preview-header .btn').trigger('click')
    await wrapper.find('.file-editor').setValue('# New Content')
    await wrapper.findAll('.modal .btn-primary')[0].trigger('click')
    await flushPromises()

    expect(mockSkillStore.updateSkillFile).toHaveBeenCalledWith(1, 'SKILL.md', '# New Content')
    expect(wrapper.find('.preview-code').text()).toContain('# New Content')
  })

  it('deletes the selected skill', async () => {
    mockSkillStore.skills = [
      { id: 1, name: 'brainstorming', description: 'desc', created_at: '2026-03-28', updated_at: '2026-03-28' }
    ]
    mockSkillStore.fetchSkillFiles.mockResolvedValue([])

    const wrapper = mountView()
    await flushPromises()

    const deleteButton = wrapper.findAll('.header-actions .btn')[1]
    await deleteButton.trigger('click')
    await flushPromises()

    expect(window.confirm).toHaveBeenCalled()
    expect(mockSkillStore.deleteSkill).toHaveBeenCalledWith(1)
  })
})
