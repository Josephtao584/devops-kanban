<template>
  <el-card class="team-card" shadow="hover">
    <template #header>
      <div class="team-header">
        <div class="team-header__left">
          <div class="team-symbol">
            <el-icon size="16"><UserFilled /></el-icon>
          </div>
          <div class="team-name-block">
            <h3 class="team-name">{{ props.team.name }}</h3>
            <p class="team-repo-count">{{ projectCount }} {{ $t('team.repoCount') }}</p>
          </div>
        </div>

        <div class="team-header__right">
          <el-button size="small" text @click.stop="addDialogVisible = true">
            <el-icon><Plus /></el-icon>
            {{ $t('team.addProject') }}
          </el-button>
          <el-dropdown trigger="click">
            <el-button link @click.stop>
              <el-icon><MoreFilled /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click.stop="$emit('edit', props.team)">
                  <el-icon><Edit /></el-icon>
                  {{ $t('common.edit') }}
                </el-dropdown-item>
                <el-dropdown-item divided @click.stop="$emit('delete', props.team)">
                  <el-icon><Delete /></el-icon>
                  {{ $t('common.delete') }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
      <p v-if="props.team.description" class="team-description">{{ props.team.description }}</p>
    </template>

    <div class="team-card__body">
      <div v-if="projectsLoading" class="projects-loading">
        <el-icon class="is-loading" :size="20"><Loading /></el-icon>
        <span>加载中...</span>
      </div>

      <div v-else-if="sortedProjects.length" class="project-compact-grid">
        <div
          v-for="proj in sortedProjects"
          :key="proj.id"
          class="project-compact-card"
          :class="{ 'is-knowledge': proj.repo_role === 'knowledge' }"
          title="打开工作空间"
          @click.stop="openProject(proj)"
        >
          <div class="compact-icon">
            <el-icon v-if="proj.repo_role === 'knowledge'"><Reading /></el-icon>
            <el-icon v-else><Folder /></el-icon>
          </div>
          <div class="compact-info">
            <span class="compact-name">{{ proj.name }}</span>
            <span class="compact-role" :class="proj.repo_role === 'knowledge' ? 'role-knowledge' : 'role-dev'">
              {{ proj.repo_role === 'knowledge' ? '知识仓库' : '开发仓库' }}
            </span>
          </div>
          <button
            v-if="proj.repo_role === 'knowledge'"
            class="compact-browse-btn"
            title="阅读知识库内容"
            @click.stop="openKnowledge(proj)"
          >
            阅读
          </button>
        </div>
      </div>

      <div v-else class="empty-projects-hint">
        {{ $t('team.noProjectsInTeam') }}
      </div>
    </div>

    <el-dialog
      v-model="addDialogVisible"
      :title="$t('team.addProjectToTeam')"
      width="480px"
      top="15vh"
      class="add-project-dialog"
      :show-close="true"
    >
      <div class="add-project-content">
        <div class="field-label">{{ $t('project.selectProject') }}</div>
        <el-select
          v-model="addForm.projectId"
          :placeholder="$t('project.selectProject')"
          style="width: 100%"
          filterable
          clearable
        >
          <el-option
            v-for="p in availableProjects"
            :key="p.id"
            :value="p.id"
            :label="p.name"
          >
            <div class="project-option">
              <el-icon class="project-option-icon"><Folder /></el-icon>
              <span class="project-option-name">{{ p.name }}</span>
            </div>
          </el-option>
        </el-select>

        <div class="field-label">{{ $t('team.repoRole') }}</div>
        <div class="role-selector">
          <div
            class="role-option"
            :class="{ active: addForm.repoRole === 'development' }"
            @click="addForm.repoRole = 'development'"
          >
            <div class="role-icon role-icon-dev">
              <el-icon><Setting /></el-icon>
            </div>
            <div class="role-text">
              <span class="role-title">开发仓库</span>
              <span class="role-desc">用于日常开发迭代</span>
            </div>
          </div>
          <div
            class="role-option"
            :class="{ active: addForm.repoRole === 'knowledge' }"
            @click="addForm.repoRole = 'knowledge'"
          >
            <div class="role-icon role-icon-knowledge">
              <el-icon><Reading /></el-icon>
            </div>
            <div class="role-text">
              <span class="role-title">知识仓库</span>
              <span class="role-desc">存放文档、规范、设计</span>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="addDialogVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button
          type="primary"
          :disabled="!addForm.projectId"
          :loading="adding"
          @click="handleAddProject"
        >
          确认添加
        </el-button>
      </template>
    </el-dialog>

    <KnowledgeRepoDialog
      v-model="knowledgeDialogVisible"
      :project="knowledgeDialogProject"
    />
  </el-card>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { UserFilled, Edit, Delete, MoreFilled, Plus, Loading, Folder, Setting, Reading } from '@element-plus/icons-vue'
import { useProjectStore } from '../../stores/projectStore'
import * as teamApi from '../../api/team'
import KnowledgeRepoDialog from '../workspace/KnowledgeRepoDialog.vue'

const props = defineProps({
  team: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['edit', 'delete', 'refresh'])
const router = useRouter()
const projectStore = useProjectStore()
const projectsLoading = ref(false)
const adding = ref(false)
const addDialogVisible = ref(false)
const addForm = ref({ projectId: null, repoRole: 'development' })
const projectsLoaded = ref(props.team.projects || [])

const projectCount = computed(() => projectsLoaded.value.length)

// Sort: knowledge first, then development
const sortedProjects = computed(() => {
  const sorted = [...projectsLoaded.value]
  sorted.sort((a, b) => {
    if (a.repo_role === 'knowledge' && b.repo_role !== 'knowledge') return -1
    if (a.repo_role !== 'knowledge' && b.repo_role === 'knowledge') return 1
    return 0
  })
  return sorted
})

const availableProjects = computed(() =>
  (projectStore.projects || []).filter(p => !p.team_id || p.team_id === props.team.id)
    .filter(p => !projectsLoaded.value.some(existing => existing.id === p.id))
)

onMounted(async () => {
  await loadProjects()
})

watch(addDialogVisible, async (visible) => {
  if (visible && !projectStore.projects?.length) {
    await projectStore.fetchProjects()
  }
})

async function loadProjects() {
  projectsLoading.value = true
  try {
    const resp = await teamApi.getTeam(props.team.id)
    if (resp?.data?.projects) {
      projectsLoaded.value = resp.data.projects
    }
  } catch { /* ignore */ } finally {
    projectsLoading.value = false
  }
}

function openProject(proj) {
  router.push(`/workspace/${proj.id}`)
}

function openKnowledge(proj) {
  knowledgeDialogProject.value = proj
  knowledgeDialogVisible.value = true
}

const knowledgeDialogVisible = ref(false)
const knowledgeDialogProject = ref(null)

async function handleAddProject() {
  if (!addForm.value.projectId) return
  adding.value = true
  try {
    await teamApi.addProjectToTeam(props.team.id, {
      project_id: addForm.value.projectId,
      repo_role: addForm.value.repoRole
    })
    addForm.value = { projectId: null, repoRole: 'development' }
    addDialogVisible.value = false
    await loadProjects()
    await projectStore.fetchProjects()
    emit('refresh')
  } catch (e) {
    // Error handled by API
  } finally {
    adding.value = false
  }
}
</script>

<style scoped>
.team-card {
  display: flex;
  flex-direction: column;
  position: relative;
  border: 1px solid var(--border-color);
  border-radius: 14px;
  background: linear-gradient(180deg, #ffffff 0%, #fbfdfd 100%);
  transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
  overflow: hidden;
}

.team-card::before {
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

.team-card:hover::before {
  opacity: 1;
}

.team-card :deep(.el-card__header) {
  padding: 16px 20px 10px;
  border-bottom: 1px solid var(--border-color);
}

.team-card :deep(.el-card__body) {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 14px 20px 18px;
  gap: 14px;
}

.team-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.team-header__left {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.team-header__right {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.team-symbol {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-color-strong);
  background: linear-gradient(135deg, rgba(37, 198, 201, 0.18) 0%, rgba(37, 198, 201, 0.06) 100%);
  border: 1px solid rgba(37, 198, 201, 0.2);
  flex-shrink: 0;
}

.team-name-block {
  min-width: 0;
}

.team-name {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.team-repo-count {
  margin: 4px 0 0;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.team-description {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.projects-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.project-compact-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}

.project-compact-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.project-compact-card:hover {
  border-color: var(--accent-color);
  background: var(--accent-color-soft);
  transform: translateY(-1px);
}

.project-compact-card.is-knowledge {
  background: linear-gradient(180deg, rgba(255, 244, 214, 0.55) 0%, rgba(255, 250, 240, 0.7) 100%);
  border-color: rgba(230, 162, 60, 0.35);
}

.project-compact-card.is-knowledge:hover {
  border-color: rgba(230, 162, 60, 0.7);
  background: rgba(230, 162, 60, 0.12);
}

.project-compact-card.is-knowledge .compact-icon {
  color: #e6a23c;
  background: linear-gradient(135deg, rgba(230, 162, 60, 0.18) 0%, rgba(230, 162, 60, 0.06) 100%);
  border-color: rgba(230, 162, 60, 0.25);
}

.compact-browse-btn {
  flex-shrink: 0;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  color: #b8821b;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(230, 162, 60, 0.5);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.compact-browse-btn:hover {
  background: #e6a23c;
  color: #fff;
  border-color: #e6a23c;
}

.compact-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-color-strong);
  background: linear-gradient(135deg, rgba(37, 198, 201, 0.15) 0%, rgba(37, 198, 201, 0.05) 100%);
  border: 1px solid rgba(37, 198, 201, 0.15);
  flex-shrink: 0;
}

.compact-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.compact-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compact-role {
  font-size: 10px;
  font-weight: 500;
  display: inline-block;
  width: fit-content;
}

.compact-role.role-knowledge {
  color: #e6a23c;
}

.compact-role.role-dev {
  color: var(--done-strong);
}

.empty-projects-hint {
  color: var(--text-secondary);
  font-size: 13px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 8px;
  text-align: center;
  border: 1px dashed rgba(37, 198, 201, 0.25);
}

/* Add project dialog styles */
.add-project-dialog :deep(.el-overlay) {
  background-color: rgba(0, 0, 0, 0.15) !important;
}

.add-project-dialog :deep(.el-dialog__header) {
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--border-color);
}

.add-project-dialog :deep(.el-dialog__body) {
  padding: 24px;
}

.add-project-dialog :deep(.el-dialog__footer) {
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
}

.add-project-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: -8px;
}

.project-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.project-option-icon {
  color: var(--accent-color);
}

.project-option-name {
  font-size: 13px;
}

.role-selector {
  display: flex;
  gap: 12px;
}

.role-option {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 10px;
  border: 2px solid var(--border-color);
  background: var(--bg-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.role-option:hover {
  border-color: var(--accent-color);
  background: var(--accent-color-soft);
}

.role-option.active {
  border-color: var(--accent-color);
  background: rgba(37, 198, 201, 0.08);
}

.role-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.role-icon-dev {
  background: rgba(37, 198, 201, 0.12);
  color: var(--accent-color);
}

.role-icon-knowledge {
  background: rgba(230, 162, 60, 0.12);
  color: #e6a23c;
}

.role-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.role-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.role-desc {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
</style>
