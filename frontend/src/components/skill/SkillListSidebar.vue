<template>
  <div class="skill-list-panel">
    <div class="panel-header">
      <h3>{{ $t('skill.skillList') }}</h3>
      <span class="skill-count">{{ skills.length }}</span>
    </div>
    <div class="skill-filter-bar">
      <el-select
        :model-value="selectedTemplateId"
        @update:model-value="emit('update:selectedTemplateId', $event)"
        :placeholder="$t('skill.filterAllTemplates')"
        clearable
        class="skill-filter-select"
        size="small"
      >
        <el-option
          v-for="tpl in templates"
          :key="tpl.template_id"
          :label="tpl.name"
          :value="tpl.template_id"
        />
      </el-select>
      <span v-if="selectedTemplateId" class="skill-filter-badge">
        <span class="badge-dot"></span>
        {{ $t('skill.filteringByTemplate') }}
      </span>
    </div>
    <div class="skill-list" v-if="!loading">
      <draggable
        :list="skills"
        :animation="200"
        ghost-class="ghost-item"
        drag-class="drag-item"
        handle=".drag-handle"
        item-key="id"
        @end="onDragEnd"
      >
        <template #item="{ element }">
          <div
            class="skill-list-item"
            :class="{ 'active': selectedId === element.id }"
            @click.stop="emit('select', element)"
          >
            <span class="drag-handle" :title="$t('skill.dragToReorder')">&#9776;</span>
            <span class="skill-list-item__name">{{ element.name }}</span>
          </div>
        </template>
      </draggable>
      <div v-if="skills.length === 0" class="empty-list">
        {{ $t('skill.noSkills') }}
      </div>
    </div>
    <div v-else class="loading-state">
      {{ $t('common.loading') }}
    </div>
  </div>
</template>

<script setup>
import draggable from 'vuedraggable'

defineProps({
  skills: { type: Array, default: () => [] },
  selectedId: { type: [Number, String], default: null },
  loading: { type: Boolean, default: false },
  selectedTemplateId: { type: String, default: '' },
  templates: { type: Array, default: () => [] }
})

const emit = defineEmits(['select', 'update:selectedTemplateId', 'reorder'])

const onDragEnd = (evt) => {
  emit('reorder', evt)
}
</script>

<style scoped>
.skill-list-panel {
  width: 300px;
  flex-shrink: 0;
  background: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-color);
}

.panel-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.skill-count {
  background: var(--accent-color-soft);
  color: var(--accent-color-strong, var(--accent-color));
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  min-width: 22px;
  text-align: center;
}

.skill-filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color);
  background: var(--panel-bg);
  flex-shrink: 0;
}

.skill-filter-select {
  flex: 1;
  min-width: 0;
}

.skill-filter-select :deep(.el-input__wrapper) {
  background: #fff;
  box-shadow: 0 0 0 1px var(--border-color) inset;
  border-radius: 8px;
  transition: box-shadow 0.18s ease;
}

.skill-filter-select :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--accent-color-soft, rgba(37, 198, 201, 0.5)) inset;
}

.skill-filter-select :deep(.el-input.is-focus .el-input__wrapper),
.skill-filter-select :deep(.el-input__wrapper.is-focus) {
  box-shadow:
    0 0 0 1px var(--accent-color) inset,
    0 0 0 3px rgba(37, 198, 201, 0.12);
}

.skill-filter-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: var(--accent-color-soft, rgba(37, 198, 201, 0.12));
  color: var(--accent-color-strong, var(--accent-color));
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-color);
  animation: badge-pulse 2s ease-in-out infinite;
}

@keyframes badge-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.skill-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  background: var(--panel-bg);
}

.skill-list-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: border-color 0.18s ease, background-color 0.18s ease, box-shadow 0.18s ease;
  margin-bottom: 8px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  text-align: left;
}

.skill-list-item:hover {
  background: var(--bg-secondary);
  border-color: rgba(37, 198, 201, 0.24);
}

.skill-list-item.active {
  background: rgba(37, 198, 201, 0.05);
  border-color: var(--accent-color);
  box-shadow: inset 0 0 0 1px rgba(37, 198, 201, 0.12);
}

.drag-handle {
  cursor: grab;
  color: var(--text-secondary);
  font-size: 14px;
  opacity: 0.4;
  transition: opacity 0.15s ease;
  flex-shrink: 0;
  line-height: 1;
  user-select: none;
}

.skill-list-item:hover .drag-handle {
  opacity: 1;
}

.drag-handle:active {
  cursor: grabbing;
}

.skill-list-item__name {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: 0.01em;
  flex: 1;
  min-width: 0;
}

.loading-state, .empty-list {
  padding: 24px 16px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
}

.ghost-item {
  opacity: 0.4;
  background: var(--accent-color-soft);
}

.drag-item {
  opacity: 0.8;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
</style>
