import { defineStore } from 'pinia'
import { useCrudStore } from '../composables/useCrudStore'
import * as skillApi from '../api/skill'

export const useSkillStore = defineStore('skill', () => {
  const crud = useCrudStore({
    api: skillApi,
    apiMethods: {
      getAll: 'list',
      getById: 'get',
      create: 'create',
      update: 'update',
      delete: 'delete'
    }
  })

  const fetchSkillFiles = async (skillId) => {
    const response = await skillApi.listFiles(skillId)
    if (response.success) {
      return response.data
    }
    throw new Error(response.message || 'Failed to fetch skill files')
  }

  const fetchSkillFile = async (skillId, filePath) => {
    const response = await skillApi.getFile(skillId, filePath)
    if (response.success) {
      return response.data
    }
    throw new Error(response.message || 'Failed to fetch skill file')
  }

  const updateSkillFile = async (skillId, filePath, content) => {
    const response = await skillApi.updateFile(skillId, filePath, content)
    if (response.success) {
      return response.data
    }
    throw new Error(response.message || 'Failed to update skill file')
  }

  const uploadSkillZip = async (skillId, zipBase64) => {
    const response = await skillApi.uploadZip(skillId, zipBase64)
    if (response.success) {
      return response.data
    }
    throw new Error(response.message || 'Failed to upload skill zip')
  }

  return {
    skills: crud.items,
    currentSkill: crud.currentItem,
    loading: crud.loading,
    error: crud.error,
    fetchSkills: crud.fetchAll,
    fetchSkill: crud.fetchById,
    createSkill: crud.create,
    updateSkill: crud.update,
    deleteSkill: crud.deleteItem,
    setCurrentSkill: crud.setCurrentItem,
    clearSkills: crud.clearItems,
    clearError: crud.clearError,
    fetchSkillFiles,
    fetchSkillFile,
    updateSkillFile,
    uploadSkillZip
  }
})