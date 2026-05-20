<template>
  <div class="project-list-view">
    <div class="project-home">
      <section class="hero-banner surface-panel">
        <div class="hero-banner__decor hero-banner__decor--a"></div>
        <div class="hero-banner__decor hero-banner__decor--b"></div>
        <div class="hero-banner__inner">
          <div class="hero-banner__content">
            <h1 class="hero-banner__title">Cooperation Platform</h1>
            <p class="hero-banner__slogan">{{ $t('project.homeSlogan') }}</p>
          </div>
          <div class="hero-banner__actions">
            <el-button type="primary" size="large" class="hero-banner__cta" @click="showCreateTeamDialog">
              <el-icon><Plus /></el-icon>
              {{ $t('team.newTeam') }}
            </el-button>
          </div>
        </div>
      </section>

      <section class="workspace-panel surface-panel">
        <div class="page-header workspace-panel__header">
          <div class="page-header__content">
            <div class="page-header__title">{{ $t('team.teamWorkspaceTitle') }}</div>
            <p class="page-header__description">{{ $t('project.workspaceDescription') }}</p>
          </div>
          <div class="page-actions">
            <span class="workspace-panel__count">{{ totalTeamProjects }} {{ $t('project.workspaceCountSuffix') }}</span>
          </div>
        </div>

        <div class="workspace-panel__body">
          <el-skeleton v-if="teamLoading" :rows="6" animated />

          <div v-else-if="teamStore.teams.length === 0" class="empty-workspace">
            <div class="empty-workspace__icon">
              <el-icon><UserFilled /></el-icon>
            </div>
            <h2 class="empty-workspace__title">{{ $t('team.emptyTeamTitle') }}</h2>
            <p class="empty-workspace__description">{{ $t('project.emptyDescription') }}</p>
            <el-button type="primary" @click="showCreateTeamDialog">{{ $t('team.createFirstTeam') }}</el-button>
          </div>

          <div v-else class="team-grid">
            <TeamCard
              v-for="teamItem in teamStore.teams"
              :key="teamItem.id"
              :team="teamItem"
              @edit="showEditTeamDialog"
              @delete="handleDeleteTeam"
            />
          </div>

          <div v-if="unassignedProjects.length" class="unassigned-section">
            <div class="unassigned-header">
              <h3 class="unassigned-title">{{ $t('team.unassignedTitle') }}</h3>
            </div>
            <div class="project-grid">
              <ProjectCard
                v-for="project in unassignedProjects"
                :key="project.id"
                :project="project"
                @click="openProject"
                @edit="showEditDialog"
                @delete="handleDelete"
              />
            </div>
          </div>
        </div>
      </section>

      <ProjectFormDialog
        v-model="dialogVisible"
        :project="editingProject"
        :loading="submitting"
        @submit="handleSubmit"
      />

      <TeamFormDialog
        v-model="teamDialogVisible"
        :team="editingTeam"
        :loading="teamSubmitting"
        @submit="handleTeamSubmit"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, FolderOpened, UserFilled } from '@element-plus/icons-vue'
import { useProjectStore } from '../stores/projectStore'
import { useTaskStore } from '../stores/taskStore'
import { useTeamStore } from '../stores/teamStore'
import ProjectCard from '../components/project/ProjectCard.vue'
import ProjectFormDialog from '../components/project/ProjectFormDialog.vue'
import TeamCard from '../components/team/TeamCard.vue'
import TeamFormDialog from '../components/team/TeamFormDialog.vue'

const { t } = useI18n()
const router = useRouter()
const projectStore = useProjectStore()
const taskStore = useTaskStore()
const teamStore = useTeamStore()

const teamLoading = computed(() => teamStore.loading)
const projects = computed(() => projectStore.projects)

const totalTeamProjects = computed(() =>
  teamStore.teams.reduce((sum, team) => sum + (team.projects?.length || 0), 0)
)

const unassignedProjects = computed(() =>
  projectStore.projects.filter(p => !p.team_id)
)

const dialogVisible = ref(false)
const editingProject = ref(null)
const submitting = ref(false)

const teamDialogVisible = ref(false)
const editingTeam = ref(null)
const teamSubmitting = ref(false)

onMounted(() => {
  projectStore.fetchProjects()
  teamStore.fetchTeams()
})

// Project dialog handlers
const showCreateDialog = () => {
  editingProject.value = null
  dialogVisible.value = true
}

const showEditDialog = (project) => {
  editingProject.value = project
  dialogVisible.value = true
}

const handleSubmit = async (formData) => {
  submitting.value = true
  try {
    if (editingProject.value) {
      await projectStore.updateProject(editingProject.value.id, formData)
      ElMessage.success(t('project.updated'))
    } else {
      const project = await projectStore.createProject(formData)
      ElMessage.success(t('project.created'))

      if (formData.createExplorationTask && project?.data?.id) {
        try {
          await taskStore.createTask({
            projectId: project.data.id,
            title: t('project.explorationTaskTitle'),
            description: t('project.explorationTaskDescription')
          })
          ElMessage.success(t('project.explorationTaskCreated'))
        } catch {
          ElMessage.warning(t('project.explorationTaskCreateFailed'))
        }
      }
    }
    dialogVisible.value = false
    editingProject.value = null
  } catch {
    ElMessage.error(editingProject.value ? t('project.updateFailed') : t('project.createFailed'))
  } finally {
    submitting.value = false
  }
}

const handleDelete = async (project) => {
  try {
    await ElMessageBox.confirm(
      t('project.deleteConfirmMessage', { name: project.name }),
      t('project.deleteConfirmTitle'),
      {
        confirmButtonText: t('common.delete'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
  } catch {
    return
  }

  try {
    await projectStore.deleteProject(project.id)
    ElMessage.success(t('project.deleted'))
  } catch {
    ElMessage.error(t('project.deleteFailed'))
  }
}

const openProject = (project) => {
  projectStore.setCurrentProject(project)
  router.push(`/workspace/${project.id}`)
}

watch(() => dialogVisible.value, (newValue) => {
  if (!newValue) {
    editingProject.value = null
  }
})

// Team dialog handlers
const showCreateTeamDialog = () => {
  editingTeam.value = null
  teamDialogVisible.value = true
}

const showEditTeamDialog = (teamItem) => {
  editingTeam.value = teamItem
  teamDialogVisible.value = true
}

const handleTeamSubmit = async (formData) => {
  teamSubmitting.value = true
  try {
    if (editingTeam.value) {
      await teamStore.updateTeam(editingTeam.value.id, formData)
      ElMessage.success(t('team.updated'))
    } else {
      await teamStore.createTeam(formData)
      ElMessage.success(t('team.created'))
    }
    teamDialogVisible.value = false
    editingTeam.value = null
    teamStore.fetchTeams()
  } catch {
    ElMessage.error(editingTeam.value ? t('team.updateFailed') : t('team.createFailed'))
  } finally {
    teamSubmitting.value = false
  }
}

const handleDeleteTeam = async (teamItem) => {
  try {
    await ElMessageBox.confirm(
      t('team.deleteConfirmMessage', { name: teamItem.name }),
      t('team.deleteConfirmTitle'),
      {
        confirmButtonText: t('common.delete'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
  } catch { return }

  try {
    await teamStore.deleteTeam(teamItem.id)
    ElMessage.success(t('team.deleted'))
    teamStore.fetchTeams()
  } catch {
    ElMessage.error(t('team.deleteFailed'))
  }
}
</script>

<style scoped>
.project-list-view {
  min-height: 100%;
  padding: var(--page-padding);
  background:
    radial-gradient(120% 80% at 20% -10%, rgba(37, 198, 201, 0.10), transparent 60%),
    radial-gradient(80% 60% at 95% 0%, rgba(99, 102, 241, 0.06), transparent 65%),
    var(--page-bg);
}

.project-home {
  width: 100%;
  max-width: var(--page-max-width-narrow);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Hero banner with soft gradient */
.hero-banner {
  position: relative;
  overflow: hidden;
  padding: 32px 36px;
  border-radius: 18px;
  border: 1px solid rgba(37, 198, 201, 0.18);
  background:
    linear-gradient(135deg, rgba(37, 198, 201, 0.10) 0%, rgba(37, 198, 201, 0.02) 50%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, #ffffff 100%);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.7) inset,
    0 6px 18px rgba(15, 35, 50, 0.04),
    0 24px 48px rgba(15, 35, 50, 0.05);
}

.hero-banner__decor {
  position: absolute;
  pointer-events: none;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.55;
}

.hero-banner__decor--a {
  top: -80px;
  right: -60px;
  width: 260px;
  height: 260px;
  background: radial-gradient(circle, rgba(37, 198, 201, 0.45), transparent 70%);
}

.hero-banner__decor--b {
  bottom: -120px;
  left: 30%;
  width: 280px;
  height: 280px;
  background: radial-gradient(circle, rgba(124, 92, 246, 0.18), transparent 70%);
}

.hero-banner__inner {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 24px;
  flex-wrap: wrap;
  z-index: 1;
}

.hero-banner__content {
  flex: 1;
  min-width: 0;
  max-width: 720px;
}

.hero-banner__title {
  margin: 0 0 8px;
  font-size: 30px;
  line-height: 1.15;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  background: linear-gradient(135deg, #0f3a3b 0%, #25C6C9 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-banner__description {
  margin: 0;
  font-size: 14px;
  line-height: 1.65;
  color: var(--text-secondary);
  max-width: 600px;
}

.hero-banner__slogan {
  margin: 4px 0 0;
  font-size: 16px;
  line-height: 1.5;
  font-weight: 500;
  color: var(--text-secondary);
  letter-spacing: 0.02em;
  max-width: 600px;
}

.hero-banner__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.hero-banner__cta :deep(.el-icon) {
  margin-right: 6px;
}

.team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(480px, 1fr));
  gap: 18px;
}

.workspace-panel {
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(8px);
  box-shadow: 0 1px 2px rgba(15, 35, 50, 0.04);
}

.workspace-panel__header {
  border-bottom: 1px solid var(--border-color);
  padding: 18px 24px;
}

.workspace-panel__count {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 999px;
  background: var(--surface-tint-strong);
  color: var(--accent-color-strong);
  font-size: 12px;
  font-weight: 600;
  border: 1px solid rgba(37, 198, 201, 0.18);
}

.workspace-panel__body {
  padding: 24px;
}

.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 18px;
}

.empty-workspace {
  min-height: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 40px;
  text-align: center;
  border: 1px dashed var(--border-color);
  border-radius: 14px;
  background:
    linear-gradient(180deg, rgba(37, 198, 201, 0.02), transparent),
    var(--bg-secondary);
}

.empty-workspace__icon {
  width: 60px;
  height: 60px;
  border-radius: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  color: var(--accent-color-strong);
  background: var(--surface-tint-strong);
  border: 1px solid rgba(37, 198, 201, 0.18);
}

.empty-workspace__title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
}

.empty-workspace__description {
  margin: 0;
  max-width: 560px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-secondary);
}

.unassigned-section {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--border-color);
}

.unassigned-header {
  margin-bottom: 16px;
}

.unassigned-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

</style>
