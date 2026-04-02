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

  it('deletes the selected skill', async () => {
    mockSkillStore.skills = [
      { id: 1, name: 'brainstorming', description: 'desc', created_at: '2026-03-28', updated_at: '2026-03-28' }
    ]
    mockSkillStore.fetchSkillFiles.mockResolvedValue([])

    const wrapper = mountView()
    await flushPromises()

    const deleteButton = wrapper.findAll('.header-actions .btn').find((button) => button.text().includes('删除'))
    expect(deleteButton).toBeTruthy()
    await deleteButton.trigger('click')
    await flushPromises()

    expect(window.confirm).toHaveBeenCalled()
    expect(mockSkillStore.deleteSkill).toHaveBeenCalledWith(1)
  })

  it('file tree is collapsed by default when skill is selected', async () => {
    mockSkillStore.skills = [
      { id: 1, name: 'brainstorming', description: 'desc', created_at: '2026-03-28', updated_at: '2026-03-28' }
    ]
    // Nested file structure: docs/guide.md and SKILL.md
    mockSkillStore.fetchSkillFiles.mockResolvedValue(['docs/guide.md', 'SKILL.md'])

    const wrapper = mountView()
    await flushPromises()

    const tree = wrapper.findComponent({ name: 'ElTree' })
    expect(tree.exists()).toBe(true)

    // Get all visible tree node contents
    const visibleNodes = wrapper.findAll('.el-tree-node__content')
    // Only root-level nodes should be visible (docs folder), not children (guide.md)
    expect(visibleNodes.length).toBe(2) // docs folder and SKILL.md at root level
  })

  it('can manually expand a collapsed directory', async () => {
    mockSkillStore.skills = [
      { id: 1, name: 'brainstorming', description: 'desc', created_at: '2026-03-28', updated_at: '2026-03-28' }
    ]
    mockSkillStore.fetchSkillFiles.mockResolvedValue(['docs/guide.md', 'SKILL.md'])

    const wrapper = mountView()
    await flushPromises()

    // Find the docs folder node and click to expand
    const docsNode = wrapper.findAll('.el-tree-node').find((node) =>
      node.find('.node-label').text().includes('docs')
    )
    expect(docsNode).toBeTruthy()

    // Click on the expand icon (arrow)
    await docsNode.find('.el-tree-node__expand-icon').trigger('click')
    await flushPromises()

    // After expanding, the child guide.md should be visible
    const visibleNodes = wrapper.findAll('.el-tree-node__content')
    expect(visibleNodes.length).toBeGreaterThan(2)
  })

  it('refresh keeps file tree collapsed', async () => {
    mockSkillStore.skills = [
      { id: 1, name: 'brainstorming', description: 'desc', created_at: '2026-03-28', updated_at: '2026-03-28' }
    ]
    mockSkillStore.fetchSkillFiles.mockResolvedValue(['docs/guide.md', 'SKILL.md'])

    const wrapper = mountView()
    await flushPromises()

    // Initially collapsed
    let visibleNodes = wrapper.findAll('.el-tree-node__content')
    expect(visibleNodes.length).toBe(2) // docs folder and SKILL.md only

    // Click refresh button
    await wrapper.find('.section-actions .btn-secondary').trigger('click')
    await flushPromises()

    // Should still be collapsed
    visibleNodes = wrapper.findAll('.el-tree-node__content')
    expect(visibleNodes.length).toBe(2)
  })

  it('switching skill keeps new skill file tree collapsed', async () => {
    mockSkillStore.skills = [
      { id: 1, name: 'brainstorming', description: 'desc1', created_at: '2026-03-28', updated_at: '2026-03-28' },
      { id: 2, name: 'debugging', description: 'desc2', created_at: '2026-03-28', updated_at: '2026-03-28' }
    ]

    // First skill has nested files
    mockSkillStore.fetchSkillFiles.mockImplementation((skillId) => {
      if (skillId === 1) return Promise.resolve(['docs/a.md', 'b.md'])
      return Promise.resolve(['c.md'])
    })

    const wrapper = mountView()
    await flushPromises()

    // Initially on first skill, tree should be collapsed
    let visibleNodes = wrapper.findAll('.el-tree-node__content')
    expect(visibleNodes.length).toBe(2) // docs folder and b.md

    // Click on second skill
    await wrapper.findAll('.skill-list-item')[1].trigger('click')
    await flushPromises()

    // Second skill should also be collapsed
    visibleNodes = wrapper.findAll('.el-tree-node__content')
    expect(visibleNodes.length).toBe(1) // only c.md
  })

  it('displays empty files state when skill has no files', async () => {
    mockSkillStore.skills = [
      { id: 1, name: 'empty-skill', description: 'desc', created_at: '2026-03-28', updated_at: '2026-03-28' }
    ]
    mockSkillStore.fetchSkillFiles.mockResolvedValue([])

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('.empty-files').exists()).toBe(true)
    expect(wrapper.findAll('.el-tree-node__content')).toHaveLength(0)
  })
})
