<template>
  <div class="scope-selector">
    <label>{{ $t('dashboard.scope.team') }}</label>
    <select :value="modelValue.teamId ?? ''" @change="onTeamChange(parseId($event.target.value))">
      <option value="">{{ $t('dashboard.scope.all') }}</option>
      <option v-for="t in teams" :key="t.id" :value="t.id" data-test="team-option">{{ t.name }}</option>
    </select>

    <label>{{ $t('dashboard.scope.project') }}</label>
    <select :value="modelValue.projectId ?? ''" @change="onProjectChange(parseId($event.target.value))">
      <option value="">{{ $t('dashboard.scope.all') }}</option>
      <option v-for="p in filteredProjects" :key="p.id" :value="p.id" data-test="project-option">{{ p.name }}</option>
    </select>
  </div>
</template>

<script>
export default {
  name: 'ScopeSelector',
  props: {
    teams: { type: Array, required: true },
    projects: { type: Array, required: true },
    modelValue: { type: Object, required: true },
  },
  emits: ['update:modelValue'],
  computed: {
    filteredProjects() {
      const t = this.modelValue.teamId
      if (t == null) return this.projects
      return this.projects.filter(p => p.team_id === t)
    },
  },
  methods: {
    parseId(v) {
      if (v === '' || v == null) return null
      const n = Number.parseInt(v, 10)
      return Number.isFinite(n) ? n : null
    },
    onTeamChange(teamId) {
      const cur = this.modelValue.projectId
      const stillValid = cur != null && this.projects.some(p => p.id === cur && (teamId == null || p.team_id === teamId))
      this.$emit('update:modelValue', { teamId, projectId: stillValid ? cur : null })
    },
    onProjectChange(projectId) {
      this.$emit('update:modelValue', { ...this.modelValue, projectId })
    },
  },
}
</script>
