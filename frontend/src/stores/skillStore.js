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
    clearError: crud.clearError
  }
})