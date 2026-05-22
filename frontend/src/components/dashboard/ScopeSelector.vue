<template>
  <div class="scope-selector">
    <div class="scope-selector__group">
      <label class="scope-selector__label">{{ $t('dashboard.window.label') }}</label>
      <div class="scope-selector__field">
        <select
          class="scope-selector__select"
          :value="modelValue.windowDays ?? 7"
          @change="onWindowChange(parseId($event.target.value))"
        >
          <option v-for="opt in windowOptions" :key="opt.value" :value="opt.value" data-test="window-option">
            {{ $t(opt.labelKey) }}
          </option>
        </select>
        <span class="scope-selector__caret" aria-hidden="true">▾</span>
      </div>
    </div>

    <div class="scope-selector__group">
      <label class="scope-selector__label">{{ $t('dashboard.scope.team') }}</label>
      <div class="scope-selector__field">
        <select
          class="scope-selector__select"
          :value="modelValue.teamId ?? ''"
          @change="onTeamChange(parseId($event.target.value))"
        >
          <option value="">{{ $t('dashboard.scope.all') }}</option>
          <option v-for="t in teams" :key="t.id" :value="t.id" data-test="team-option">{{ t.name }}</option>
        </select>
        <span class="scope-selector__caret" aria-hidden="true">▾</span>
      </div>
    </div>

    <div class="scope-selector__group">
      <label class="scope-selector__label">{{ $t('dashboard.scope.project') }}</label>
      <div class="scope-selector__field">
        <select
          class="scope-selector__select"
          :value="modelValue.projectId ?? ''"
          @change="onProjectChange(parseId($event.target.value))"
        >
          <option value="">{{ $t('dashboard.scope.all') }}</option>
          <option v-for="p in filteredProjects" :key="p.id" :value="p.id" data-test="project-option">{{ p.name }}</option>
        </select>
        <span class="scope-selector__caret" aria-hidden="true">▾</span>
      </div>
    </div>
  </div>
</template>

<script>
const WINDOW_OPTIONS = [
  { value: 1,  labelKey: 'dashboard.window.last1' },
  { value: 7,  labelKey: 'dashboard.window.last7' },
  { value: 14, labelKey: 'dashboard.window.last14' },
  { value: 30, labelKey: 'dashboard.window.last30' },
  { value: 90, labelKey: 'dashboard.window.last90' },
]

export default {
  name: 'ScopeSelector',
  props: {
    teams: { type: Array, required: true },
    projects: { type: Array, required: true },
    modelValue: { type: Object, required: true },
  },
  emits: ['update:modelValue'],
  data: () => ({ windowOptions: WINDOW_OPTIONS }),
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
      this.$emit('update:modelValue', { ...this.modelValue, teamId, projectId: stillValid ? cur : null })
    },
    onProjectChange(projectId) {
      this.$emit('update:modelValue', { ...this.modelValue, projectId })
    },
    onWindowChange(windowDays) {
      const allowed = WINDOW_OPTIONS.map(o => o.value)
      const next = allowed.includes(windowDays) ? windowDays : 7
      this.$emit('update:modelValue', { ...this.modelValue, windowDays: next })
    },
  },
}
</script>

<style scoped>
.scope-selector {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

.scope-selector__group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.scope-selector__label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.scope-selector__field {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.scope-selector__select {
  appearance: none;
  -webkit-appearance: none;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 6px 28px 6px 12px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
  min-width: 130px;
}

.scope-selector__select:hover {
  border-color: var(--accent-color-soft);
}

.scope-selector__select:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px rgba(37, 198, 201, 0.14);
}

.scope-selector__caret {
  position: absolute;
  right: 10px;
  pointer-events: none;
  color: var(--text-muted);
  font-size: 10px;
}
</style>
