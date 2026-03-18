<template>
  <el-card class="project-card" shadow="hover" @click="$emit('click', project)">
    <template #header>
      <div class="card-header">
        <el-icon size="24"><Folder /></el-icon>
        <el-dropdown trigger="click">
          <el-button link @click.stop>
            <el-icon><MoreFilled /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click.stop="$emit('edit', project)">
                <el-icon><Edit /></el-icon>
                {{ $t('common.edit') }}
              </el-dropdown-item>
              <el-dropdown-item divided @click.stop="$emit('delete', project)">
                <el-icon><Delete /></el-icon>
                {{ $t('common.delete') }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </template>

    <h3 class="project-name">{{ project.name }}</h3>
    <p class="project-description">{{ project.description || $t('project.noDescription') }}</p>

    <template #footer>
      <div class="card-footer">
        <el-tag v-if="project.repoUrl || project.gitUrl || project.git_url" size="small" type="info" class="git-tag">
          <el-icon><Link /></el-icon>
          <span>Git</span>
        </el-tag>
        <span class="created-time">
          {{ formatDate(project.createdAt) }}
        </span>
      </div>
    </template>
  </el-card>
</template>

<script setup>
import { Folder, Edit, Delete, MoreFilled, Link } from '@element-plus/icons-vue'

defineProps({
  project: {
    type: Object,
    required: true
  }
})

defineEmits(['click', 'edit', 'delete'])

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString()
}
</script>

<style scoped>
.project-card {
  cursor: pointer;
  width: 320px;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.project-card :deep(.el-card__header) {
  padding: 16px 20px;
}

.project-card :deep(.el-card__body) {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px 20px;
}

.project-card :deep(.el-card__footer) {
  padding: 10px 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.project-name {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.project-description {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.git-tag :deep(.el-tag__content) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.created-time {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
