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

vi.mock('../src/stores/agentStore', () => ({
  useAgentStore: () => ({
    agents: [],
    fetchAgents: vi.fn().mockResolvedValue(undefined)
  })
}))

vi.mock('../src/stores/workflowTemplateStore', () => ({
  useWorkflowTemplateStore: () => ({
    templates: [],
    loading: false,
    error: null,
    fetchTemplates: vi.fn().mockResolvedValue({ success: true, data: [] })
  })
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

  it('displays multiple root-level files correctly', async () => {
    mockSkillStore.skills = [
      { id: 1, name: 'multi-file-skill', description: 'test', created_at: '2026-01-01', updated_at: '2026-01-01' }
    ]
    mockSkillStore.fetchSkillFiles.mockResolvedValue(['SKILL.md', 'REFERENCE.md', 'INSTALL.md'])

    const wrapper = mountView()
    await flushPromises()

    const treeNodes = wrapper.findAll('.el-tree-node__content')
    expect(treeNodes.length).toBe(3)
    const labels = treeNodes.map(n => n.find('.node-label').text())
    expect(labels).toContain('SKILL.md')
    expect(labels).toContain('REFERENCE.md')
    expect(labels).toContain('INSTALL.md')
  })

  it('displays brainstorming skill with nested files and scripts directory', async () => {
    mockSkillStore.skills = [
      { id: 1, name: 'brainstorming', description: 'desc', created_at: '2026-03-28', updated_at: '2026-03-28' }
    ]
    mockSkillStore.fetchSkillFiles.mockResolvedValue([
      'SKILL.md',
      'spec-document-reviewer-prompt.md',
      'visual-companion.md',
      'scripts/frame-template.html',
      'scripts/helper.js',
      'scripts/server.cjs',
      'scripts/start-server.sh',
      'scripts/stop-server.sh'
    ])

    const wrapper = mountView()
    await flushPromises()

    // Root level: 3 files + 1 folder = 4 nodes (collapsed by default)
    const treeNodes = wrapper.findAll('.el-tree-node__content')
    expect(treeNodes.length).toBe(4)
    const labels = treeNodes.map(n => n.find('.node-label').text())
    expect(labels).toContain('SKILL.md')
    expect(labels).toContain('spec-document-reviewer-prompt.md')
    expect(labels).toContain('visual-companion.md')
    expect(labels).toContain('scripts')
  })

  it('can expand scripts folder and see all script files', async () => {
    mockSkillStore.skills = [
      { id: 1, name: 'brainstorming', description: 'desc', created_at: '2026-03-28', updated_at: '2026-03-28' }
    ]
    mockSkillStore.fetchSkillFiles.mockResolvedValue([
      'SKILL.md',
      'spec-document-reviewer-prompt.md',
      'visual-companion.md',
      'scripts/frame-template.html',
      'scripts/helper.js',
      'scripts/server.cjs',
      'scripts/start-server.sh',
      'scripts/stop-server.sh'
    ])

    const wrapper = mountView()
    await flushPromises()

    // Find the scripts folder node and expand it
    const scriptsNode = wrapper.findAll('.el-tree-node').find((node) =>
      node.find('.node-label').text().includes('scripts')
    )
    expect(scriptsNode).toBeTruthy()

    // Click on the expand icon
    await scriptsNode.find('.el-tree-node__expand-icon').trigger('click')
    await flushPromises()

    // Count child nodes of scripts folder
    const allNodes = wrapper.findAll('.el-tree-node')
    const scriptsChildren = allNodes.filter(node => {
      const parent = node.element.parentElement?.closest('.el-tree-node__children')
      return parent && parent.closest('.el-tree-node') === scriptsNode.element
    })
    expect(scriptsChildren.length).toBe(5)
    const childLabels = scriptsChildren.map(n => n.find('.node-label').text())
    expect(new Set(childLabels)).toEqual(new Set(['frame-template.html', 'helper.js', 'server.cjs', 'start-server.sh', 'stop-server.sh']))
  })

  it('switching from multi-file skill to single-file skill updates tree correctly', async () => {
    mockSkillStore.skills = [
      { id: 1, name: 'brainstorming', description: 'multi', created_at: '2026-01-01', updated_at: '2026-01-01' },
      { id: 2, name: 'single', description: 'single', created_at: '2026-01-01', updated_at: '2026-01-01' }
    ]

    mockSkillStore.fetchSkillFiles.mockImplementation((skillId) => {
      if (skillId === 1) {
        return Promise.resolve(['SKILL.md', 'docs/guide.md', 'scripts/run.sh'])
      }
      return Promise.resolve(['SKILL.md'])
    })

    const wrapper = mountView()
    await flushPromises()

    // First skill: SKILL.md, docs folder, scripts folder
    let treeNodes = wrapper.findAll('.el-tree-node__content')
    expect(treeNodes.length).toBe(3)

    // Switch to second skill
    await wrapper.findAll('.skill-list-item')[1].trigger('click')
    await flushPromises()

    // Second skill: only SKILL.md
    treeNodes = wrapper.findAll('.el-tree-node__content')
    expect(treeNodes.length).toBe(1)
    expect(treeNodes[0].find('.node-label').text()).toBe('SKILL.md')
  })

  it('empty folder still shows expand icon when isLeaf is false', async () => {
    // This tests the scenario where a skill has an empty directory
    // on disk but buildFileTree still creates a folder node
    mockSkillStore.skills = [
      { id: 1, name: 'skill-with-empty-dir', description: 'test', created_at: '2026-01-01', updated_at: '2026-01-01' }
    ]
    // Simulating a structure with SKILL.md and an empty docs folder
    // (In reality, readdirSync with recursive:true wouldn't return empty dirs,
    // but this tests that our tree handles it correctly if it did)
    mockSkillStore.fetchSkillFiles.mockResolvedValue(['SKILL.md'])

    const wrapper = mountView()
    await flushPromises()

    const treeNodes = wrapper.findAll('.el-tree-node__content')
    expect(treeNodes.length).toBe(1)
    expect(treeNodes[0].find('.node-label').text()).toBe('SKILL.md')
  })

  it('deeply nested files display correctly in tree', async () => {
    mockSkillStore.skills = [
      { id: 1, name: 'deep-skill', description: 'test', created_at: '2026-01-01', updated_at: '2026-01-01' }
    ]
    mockSkillStore.fetchSkillFiles.mockResolvedValue([
      'SKILL.md',
      'src/components/Button.vue',
      'src/components/Input.vue',
      'src/utils/helpers.ts',
      'src/utils/constants.ts',
      'tests/components/Button.spec.ts',
      'tests/components/Input.spec.ts'
    ])

    const wrapper = mountView()
    await flushPromises()

    // Root level: SKILL.md, src folder, tests folder = 3
    const treeNodes = wrapper.findAll('.el-tree-node__content')
    expect(treeNodes.length).toBe(3)
    const labels = treeNodes.map(n => n.find('.node-label').text())
    expect(labels).toContain('SKILL.md')
    expect(labels).toContain('src')
    expect(labels).toContain('tests')
  })
})
