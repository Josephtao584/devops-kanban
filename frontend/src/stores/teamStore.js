import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useCrudStore } from '../composables/useCrudStore'
import * as teamApi from '../api/team'

export const useTeamStore = defineStore('team', () => {
  const crud = useCrudStore({
    api: teamApi,
    apiMethods: {
      getAll: 'getTeams',
      getById: 'getTeam',
      create: 'createTeam',
      update: 'updateTeam',
      delete: 'deleteTeam'
    }
  })

  const teamList = computed(() => crud.items.value)
  const currentTeamId = computed(() => crud.currentItem.value?.id)

  function setCurrentTeam(team) {
    crud.setCurrentItem(team)
  }

  return {
    teams: crud.items,
    currentTeam: crud.currentItem,
    loading: crud.loading,
    error: crud.error,
    teamList,
    currentTeamId,
    fetchTeams: crud.fetchAll,
    fetchTeam: crud.fetchById,
    createTeam: crud.create,
    updateTeam: crud.update,
    deleteTeam: crud.deleteItem,
    setCurrentTeam,
    clearError: crud.clearError
  }
})
