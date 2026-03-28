import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSkillStore } from '../src/stores/skillStore'

const mockSkillApi = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  listFiles: vi.fn(),
  getFile: vi.fn(),
  updateFile: vi.fn(),
  uploadZip: vi.fn()
}))

vi.mock('../src/api/skill', () => mockSkillApi)

describe('skillStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('CRUD operations', () => {
    it('fetchSkills loads skills from API', async () => {
      mockSkillApi.list.mockResolvedValue({
        success: true,
        data: [
          { id: 1, name: 'brainstorming', description: '头脑风暴' },
          { id: 2, name: 'debugging', description: '调试技能' }
        ]
      })

      const store = useSkillStore()
      const result = await store.fetchSkills()

      expect(mockSkillApi.list).toHaveBeenCalledTimes(1)
      // CRUD store returns full response from fetchAll
      expect(result).toEqual({
        success: true,
        data: [
          { id: 1, name: 'brainstorming', description: '头脑风暴' },
          { id: 2, name: 'debugging', description: '调试技能' }
        ]
      })
      expect(store.skills).toHaveLength(2)
    })

    it('fetchSkill loads single skill from API', async () => {
      mockSkillApi.get.mockResolvedValue({
        success: true,
        data: { id: 1, name: 'brainstorming', description: '头脑风暴' }
      })

      const store = useSkillStore()
      const result = await store.fetchSkill(1)

      expect(mockSkillApi.get).toHaveBeenCalledWith(1)
      expect(result).toEqual({ id: 1, name: 'brainstorming', description: '头脑风暴' })
    })

    it('createSkill creates skill via API', async () => {
      mockSkillApi.create.mockResolvedValue({
        success: true,
        data: { id: 1, name: 'new-skill', description: '新技能' }
      })

      const store = useSkillStore()
      const result = await store.createSkill({ name: 'new-skill', description: '新技能' })

      expect(mockSkillApi.create).toHaveBeenCalledWith({ name: 'new-skill', description: '新技能' })
      // CRUD store returns full response from create
      expect(result).toEqual({
        success: true,
        data: { id: 1, name: 'new-skill', description: '新技能' }
      })
    })

    it('updateSkill updates skill via API', async () => {
      mockSkillApi.update.mockResolvedValue({
        success: true,
        data: { id: 1, name: 'brainstorming', description: '更新后的描述' }
      })

      const store = useSkillStore()
      const result = await store.updateSkill(1, '更新后的描述')

      expect(mockSkillApi.update).toHaveBeenCalledWith(1, '更新后的描述')
      // CRUD store returns full response
      expect(result).toEqual({
        success: true,
        data: { id: 1, name: 'brainstorming', description: '更新后的描述' }
      })
    })

    it('deleteSkill deletes skill via API', async () => {
      mockSkillApi.delete.mockResolvedValue({ success: true })

      const store = useSkillStore()
      const result = await store.deleteSkill(1)

      expect(mockSkillApi.delete).toHaveBeenCalledWith(1)
      expect(result).toEqual({ success: true })
    })
  })

  describe('file operations', () => {
    it('fetchSkillFiles returns file list from API', async () => {
      mockSkillApi.listFiles.mockResolvedValue({
        success: true,
        data: ['SKILL.md', 'README.txt', 'scripts/helper.js']
      })

      const store = useSkillStore()
      const result = await store.fetchSkillFiles(1)

      expect(mockSkillApi.listFiles).toHaveBeenCalledWith(1)
      expect(result).toEqual(['SKILL.md', 'README.txt', 'scripts/helper.js'])
    })

    it('fetchSkillFiles throws on API failure', async () => {
      mockSkillApi.listFiles.mockResolvedValue({
        success: false,
        message: 'Failed to fetch'
      })

      const store = useSkillStore()
      await expect(store.fetchSkillFiles(1)).rejects.toThrow('Failed to fetch')
    })

    it('fetchSkillFile returns file content from API', async () => {
      mockSkillApi.getFile.mockResolvedValue({
        success: true,
        data: { path: 'SKILL.md', content: '# Skill Content' }
      })

      const store = useSkillStore()
      const result = await store.fetchSkillFile(1, 'SKILL.md')

      expect(mockSkillApi.getFile).toHaveBeenCalledWith(1, 'SKILL.md')
      expect(result).toEqual({ path: 'SKILL.md', content: '# Skill Content' })
    })

    it('updateSkillFile saves file content via API', async () => {
      mockSkillApi.updateFile.mockResolvedValue({ success: true })

      const store = useSkillStore()
      const result = await store.updateSkillFile(1, 'SKILL.md', '# Updated content')

      expect(mockSkillApi.updateFile).toHaveBeenCalledWith(1, 'SKILL.md', '# Updated content')
      expect(result).toBeUndefined()
    })

    it('uploadSkillZip uploads zip via API', async () => {
      mockSkillApi.uploadZip.mockResolvedValue({ success: true })

      const store = useSkillStore()
      const result = await store.uploadSkillZip(1, 'base64data==')

      expect(mockSkillApi.uploadZip).toHaveBeenCalledWith(1, 'base64data==')
      expect(result).toBeUndefined()
    })

    it('uploadSkillZip throws on API failure', async () => {
      mockSkillApi.uploadZip.mockResolvedValue({
        success: false,
        message: 'Upload failed'
      })

      const store = useSkillStore()
      await expect(store.uploadSkillZip(1, 'base64data==')).rejects.toThrow('Upload failed')
    })
  })

  describe('store state management', () => {
    it('setCurrentSkill updates currentItem', async () => {
      const store = useSkillStore()
      store.setCurrentSkill({ id: 5, name: 'test' })
      expect(store.currentSkill).toEqual({ id: 5, name: 'test' })
    })

    it('clearSkills empties skills array', async () => {
      const store = useSkillStore()
      store.skills.push({ id: 1 }, { id: 2 })
      store.clearSkills()
      expect(store.skills).toHaveLength(0)
    })

    it('clearError resets error state', async () => {
      const store = useSkillStore()
      store.error = 'Some error'
      store.clearError()
      expect(store.error).toBeNull()
    })
  })
})
