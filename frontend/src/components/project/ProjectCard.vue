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
  position: relative;
  border: 1px solid var(--border-color);
  border-radius: 14px;
  background: linear-gradient(180deg, #ffffff 0%, #fbfdfd 100%);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.9) inset,
    0 1px 2px rgba(15, 35, 50, 0.03);
  transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
  overflow: hidden;
}

.project-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--accent-color) 0%, rgba(124, 92, 246, 0.6) 100%);
  opacity: 0;
  transition: opacity 0.22s ease;
}

.project-card:hover {
  transform: translateY(-2px);
  border-color: rgba(37, 198, 201, 0.35);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.9) inset,
    0 8px 18px rgba(15, 35, 50, 0.06),
    0 24px 40px rgba(15, 35, 50, 0.08);
}

.project-card:hover::before {
  opacity: 1;
}

.project-card :deep(.el-card__header) {
  padding: 18px 20px 4px;
  border-bottom: none;
}

.project-card :deep(.el-card__body) {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 12px 20px 16px;
}

.project-card :deep(.el-card__footer) {
  padding: 14px 20px;
  border-top: 1px solid rgba(15, 35, 50, 0.05);
  background: linear-gradient(180deg, transparent, rgba(37, 198, 201, 0.025));
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
  width: 38px;
  height: 38px;
  border-radius: 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-color-strong);
  background:
    linear-gradient(135deg, rgba(37, 198, 201, 0.18) 0%, rgba(37, 198, 201, 0.06) 100%);
  border: 1px solid rgba(37, 198, 201, 0.2);
  flex-shrink: 0;
  box-shadow: 0 1px 2px rgba(15, 35, 50, 0.04);
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
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-mode {
  margin: 4px 0 0;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.project-card__body {
  gap: 14px;
}

.project-description {
  margin: 0;
  min-height: 60px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.65;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.project-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.project-tags :deep(.el-tag) {
  height: 22px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  border-width: 1px;
}

.project-meta {
  margin-top: auto;
  padding-top: 4px;
}

.meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.meta-label {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 600;
}

.meta-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  font-family: 'SF Mono', Menlo, Consolas, monospace;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.footer-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.footer-status::before {
  content: '';
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.18);
}

.footer-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--accent-color-strong);
  transition: gap 0.18s ease;
}

.footer-action::after {
  content: '→';
  font-size: 14px;
  font-weight: 500;
  transition: transform 0.18s ease;
}

.project-card:hover .footer-action {
  gap: 8px;
}

.project-card:hover .footer-action::after {
  transform: translateX(2px);
}
</style>
