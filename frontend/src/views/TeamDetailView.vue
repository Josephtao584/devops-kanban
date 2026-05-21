<template>
  <div class="team-detail-view">
    <div v-if="loading" class="loading-state">
      <el-skeleton :rows="4" animated />
    </div>
    <template v-else-if="team">
      <div class="team-header surface-panel">
        <div class="team-header__content">
          <el-button size="small" @click="router.push('/')">
            {{ $t('common.back', '返回') }}
          </el-button>
          <h1 class="team-title">{{ team.name }}</h1>
          <p v-if="team.description" class="team-desc">{{ team.description }}</p>
        </div>
        <el-dropdown trigger="click">
          <el-button size="small">{{ $t('common.actions', '操作') }}<el-icon class="el-icon--right"><MoreFilled /></el-icon></el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="showEditDialog">
                <el-icon><Edit /></el-icon>
                {{ $t('common.edit') }}
              </el-dropdown-item>
              <el-dropdown-item divided @click="handleDeleteTeam">
                <el-icon><Delete /></el-icon>
                {{ $t('common.delete') }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>

      <div class="repos-section surface-panel">
        <div class="section-header">
          <h2>{{ $t('team.internalRepos') }}</h2>
          <el-button size="small" type="primary" @click="showAddProjectDialog = true">
            <el-icon><Plus /></el-icon>
            {{ $t('team.addProject') }}
          </el-button>
        </div>
        <div class="repo-list">
          <div v-for="proj in projects" :key="proj.id" class="repo-item">
            <el-tag
              :type="proj.repo_role === 'knowledge' ? 'warning' : 'success'"
              size="small"
            >
              {{ proj.repo_role === 'knowledge' ? $t('team.knowledgeBadge') : $t('team.developmentBadge') }}
            </el-tag>
            <span class="repo-name">{{ proj.name }}</span>
            <el-button size="small" text type="danger" @click="handleRemoveProject(proj)">
              {{ $t('team.removeProject') }}
            </el-button>
          </div>
          <div v-if="projects.length === 0" class="empty-repos">
            {{ $t('team.noProjectsInTeam') }}
          </div>
        </div>
      </div>

      <div class="kanban-hint surface-panel">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4"/>
          <path d="M12 8h.01"/>
        </svg>
        <p>{{ $t('team.kanbanHint') }}</p>
        <el-button size="small" type="primary" @click="goToWorkspace">
          {{ $t('team.goToWorkspace') }}
        </el-button>
      </div>
    </template>

    <TeamFormDialog
      v-model="editDialogVisible"
      :team="editingTeam"
      :loading="editSubmitting"
      @submit="handleEditSubmit"
      @refresh="handleTeamRefresh"
    />

    <el-dialog v-model="showAddProjectDialog" :title="$t('team.addProjectToTeam')" width="500px">
      <el-form :model="addForm" label-position="top">
        <el-form-item :label="$t('project.selectProject')">
          <el-select v-model="addForm.projectId" style="width: 100%" :placeholder="$t('project.selectProject')">
            <el-option v-for="p in availableProjects" :key="p.id" :value="p.id" :label="p.name" />
          </el-select>
        </el-form-item>
        <el-form-item :label="$t('team.repoRole')">
          <el-radio-group v-model="addForm.repoRole">
            <el-radio value="knowledge">{{ $t('team.knowledgeBadge') }}</el-radio>
            <el-radio value="development">{{ $t('team.developmentBadge') }}</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddProjectDialog = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="addingProject" @click="handleAddProject">{{ $t('common.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete, MoreFilled } from '@element-plus/icons-vue'
import { useTeamStore } from '../stores/teamStore'
import { useProjectStore } from '../stores/projectStore'
import * as teamApi from '../api/team'
import TeamFormDialog from '../components/team/TeamFormDialog.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const teamStore = useTeamStore()
const projectStore = useProjectStore()

const team = ref(null)
const loading = ref(true)
const showAddProjectDialog = ref(false)
const addingProject = ref(false)
const addForm = ref({ projectId: null, repoRole: 'development' })

const editDialogVisible = ref(false)
const editingTeam = ref(null)
const editSubmitting = ref(false)

const projects = computed(() => team.value?.projects || [])
const availableProjects = computed(() =>
  projectStore.projects.filter(p => !p.team_id)
)

onMounted(async () => {
  const teamId = Number(route.params.id)
  await projectStore.fetchProjects()
  try {
    await teamStore.fetchTeam(teamId)
    team.value = teamStore.currentTeam
  } catch {
    ElMessage.error(t('team.loadFailed'))
  } finally {
    loading.value = false
  }
})

const showEditDialog = () => {
  editingTeam.value = team.value
  editDialogVisible.value = true
}

const handleEditSubmit = async (formData) => {
  editSubmitting.value = true
  try {
    await teamStore.updateTeam(team.value.id, formData)
    editDialogVisible.value = false
    editingTeam.value = null
    await teamStore.fetchTeam(team.value.id)
    team.value = teamStore.currentTeam
    ElMessage.success(t('team.updated'))
  } catch {
    ElMessage.error(t('team.updateFailed'))
  } finally {
    editSubmitting.value = false
  }
}

const handleTeamRefresh = async () => {
  await teamStore.fetchTeam(team.value.id)
  team.value = teamStore.currentTeam
  await projectStore.fetchProjects()
}

const handleDeleteTeam = async () => {
  try {
    await ElMessageBox.confirm(t('team.deleteConfirmMessage', { name: team.value.name }), t('team.deleteConfirmTitle'), {
      confirmButtonText: t('common.delete'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    })
  } catch { return }
  try {
    await teamStore.deleteTeam(team.value.id)
    ElMessage.success(t('team.deleted'))
    router.push('/')
  } catch {
    ElMessage.error(t('team.deleteFailed'))
  }
}

const handleAddProject = async () => {
  if (!addForm.value.projectId) {
    ElMessage.warning(t('project.selectProject'))
    return
  }
  addingProject.value = true
  try {
    await teamApi.addProjectToTeam(team.value.id, {
      project_id: addForm.value.projectId,
      repo_role: addForm.value.repoRole
    })
    ElMessage.success(t('team.projectAdded'))
    showAddProjectDialog.value = false
    addForm.value = { projectId: null, repoRole: 'development' }
    await projectStore.fetchProjects()
    await teamStore.fetchTeam(team.value.id)
    team.value = teamStore.currentTeam
  } catch (e) {
    ElMessage.error(e.message || t('team.addProjectFailed'))
  } finally {
    addingProject.value = false
  }
}

const handleRemoveProject = async (proj) => {
  try {
    await teamApi.removeProjectFromTeam(team.value.id, proj.id)
    ElMessage.success(t('team.projectRemoved'))
    await projectStore.fetchProjects()
    await teamStore.fetchTeam(team.value.id)
    team.value = teamStore.currentTeam
  } catch {
    ElMessage.error(t('team.removeProjectFailed'))
  }
}

const goToWorkspace = () => {
  router.push('/workspace')
}
</script>

<style scoped>
.team-detail-view {
  padding: var(--page-padding);
  max-width: var(--page-max-width-narrow);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.surface-panel {
  padding: 24px;
  border: 1px solid var(--border-color);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.85);
}

.loading-state {
  padding: 40px;
}

.team-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.team-header__content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.team-title {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
}

.team-desc {
  margin: 0;
  color: var(--text-secondary);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.repo-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.repo-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
}

.repo-name {
  flex: 1;
  font-weight: 600;
}

.empty-repos {
  color: var(--text-secondary);
  padding: 20px;
  text-align: center;
}

.kanban-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
  padding: 32px;
}

.kanban-hint svg {
  color: var(--text-muted);
}

.kanban-hint p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
}
</style>
