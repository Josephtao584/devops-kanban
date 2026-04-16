<template>
  <el-card class="project-card" shadow="hover" @click="$emit('click', props.project)">
    <template #header>
      <div class="card-header">
        <div class="card-header__left">
          <div class="project-symbol">
            <el-icon size="16"><Folder /></el-icon>
          </div>
          <div class="project-name-block">
            <h3 class="project-name">{{ props.project.name }}</h3>
            <p class="project-mode">{{ workspaceMode }}</p>
          </div>
        </div>

        <el-dropdown trigger="click">
          <el-button link @click.stop>
            <el-icon><MoreFilled /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click.stop="$emit('edit', props.project)">
                <el-icon><Edit /></el-icon>
                {{ $t('common.edit') }}
              </el-dropdown-item>
              <el-dropdown-item divided @click.stop="$emit('delete', props.project)">
                <el-icon><Delete /></el-icon>
                {{ $t('common.delete') }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </template>

    <div class="project-card__body">
      <p class="project-description">{{ props.project.description || $t('project.noDescription') }}</p>

      <div class="project-tags">
        <el-tag size="small" :type="hasGit ? 'success' : 'info'">{{ hasGit ? $t('project.gitConnected') : $t('project.gitPending') }}</el-tag>
        <el-tag size="small" :type="hasLocalPath ? 'success' : 'info'">{{ hasLocalPath ? $t('project.localReady') : $t('project.localPending') }}</el-tag>
      </div>

      <div v-if="formattedCreatedAt" class="project-meta">
        <div class="meta-row">
          <span class="meta-label">{{ $t('project.createdAt') }}</span>
          <span class="meta-value">{{ formattedCreatedAt }}</span>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="card-footer">
        <span class="footer-status">{{ footerStatus }}</span>
        <span class="footer-action">{{ $t('project.openWorkspace') }}</span>
      </div>
    </template>
  </el-card>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Folder, Edit, Delete, MoreFilled } from '@element-plus/icons-vue'
import { formatDate } from '../../utils/dateFormat'

const props = defineProps({
  project: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['click', 'edit', 'delete'])

const { t } = useI18n()

const hasGit = computed(() => Boolean(props.project.repoUrl || props.project.gitUrl || props.project.git_url))
const hasLocalPath = computed(() => Boolean(props.project.localPath || props.project.local_path))

const workspaceMode = computed(() => {
  if (hasGit.value && hasLocalPath.value) return t('project.modeHybrid')
  if (hasGit.value) return t('project.modeRepository')
  if (hasLocalPath.value) return t('project.modeLocal')
  return t('project.modeManual')
})

const footerStatus = computed(() => {
  if (hasGit.value || hasLocalPath.value) return t('project.statusReady')
  return t('project.statusConfigPending')
})

const formattedCreatedAt = computed(() => formatDate(props.project.createdAt))
</script>

<style scoped>
.project-card {
  cursor: pointer;
  width: 100%;
  min-height: 220px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.project-card:hover {
  border-color: rgba(37, 198, 201, 0.24);
  box-shadow: var(--shadow-md);
}

.project-card :deep(.el-card__header) {
  padding: 16px 18px 0;
  border-bottom: none;
}

.project-card :deep(.el-card__body) {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 14px 18px 16px;
}

.project-card :deep(.el-card__footer) {
  padding: 0 18px 16px;
  border-top: none;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.card-header__left {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
}

.project-symbol {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-color-strong);
  background: var(--surface-tint-strong);
  flex-shrink: 0;
}

.project-name-block {
  min-width: 0;
}

.project-name {
  margin: 0;
  font-size: 16px;
  line-height: 1.4;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.project-mode {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.project-card__body {
  gap: 14px;
}

.project-description {
  margin: 0;
  min-height: 60px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.project-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.project-meta {
  margin-top: auto;
  padding-top: 6px;
}

.meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.meta-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.meta-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.footer-status {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.footer-action {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent-color-strong);
}
</style>
