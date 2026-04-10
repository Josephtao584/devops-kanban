<template>
  <div class="project-list-view page-shell page-shell--canvas page-shell--padded">
    <div class="page-shell__inner page-shell__inner--narrow project-home">
      <div class="brand-banner">
        <h1 class="brand-wordmark">DevOps Kanban</h1>
      </div>

      <section class="surface-panel home-header">
        <div class="page-header home-header__inner">
          <div class="page-header__content">
            <p class="page-header__description">{{ $t('project.homeDescription') }}</p>
          </div>
          <div class="page-actions">
            <el-button type="primary" @click="showCreateDialog">
              <el-icon><Plus /></el-icon>
              {{ $t('project.newProject') }}
            </el-button>
          </div>
        </div>
      </section>

      <section class="workspace-panel surface-panel">
        <div class="page-header workspace-panel__header">
          <div class="page-header__content">
            <div class="page-header__title">{{ $t('project.workspaceTitle') }}</div>
            <p class="page-header__description">{{ $t('project.workspaceDescription') }}</p>
          </div>
          <div class="page-actions">
            <span class="workspace-panel__count">{{ projects.length }} {{ $t('project.workspaceCountSuffix') }}</span>
          </div>
        </div>

        <div class="workspace-panel__body">
          <el-skeleton v-if="loading" :rows="6" animated />

          <div v-else-if="projects.length === 0" class="empty-workspace">
            <div class="empty-workspace__icon">
              <el-icon><FolderOpened /></el-icon>
            </div>
            <h2 class="empty-workspace__title">{{ $t('project.emptyTitle') }}</h2>
            <p class="empty-workspace__description">{{ $t('project.emptyDescription') }}</p>
            <el-button type="primary" @click="showCreateDialog">{{ $t('project.createFirst') }}</el-button>
          </div>

          <div v-else class="project-grid">
            <ProjectCard
              v-for="project in projects"
              :key="project.id"
              :project="project"
              @click="openProject"
              @edit="showEditDialog"
              @delete="handleDelete"
            />
          </div>
        </div>
      </section>

      <ProjectFormDialog
        v-model="dialogVisible"
        :project="editingProject"
        :loading="submitting"
        @submit="handleSubmit"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, FolderOpened } from '@element-plus/icons-vue'
import { useProjectStore } from '../stores/projectStore'
import { createTask, startTask } from '../api/task.js'
import { getWorkflowTemplateById } from '../api/workflowTemplate.js'
import ProjectCard from '../components/project/ProjectCard.vue'
import ProjectFormDialog from '../components/project/ProjectFormDialog.vue'

const { t } = useI18n()
const router = useRouter()
const projectStore = useProjectStore()

const loading = computed(() => projectStore.loading)
const projects = computed(() => projectStore.projects)

const dialogVisible = ref(false)
const editingProject = ref(null)
const submitting = ref(false)

onMounted(() => {
  projectStore.fetchProjects()
})

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
          const task = await createTask({
            projectId: project.data.id,
            title: t('project.explorationTaskTitle'),
            description: t('project.explorationTaskDescription')
          })
          if (task?.data?.id) {
            const template = await getWorkflowTemplateById('repo-explorer')
            if (template?.data) {
              await startTask(task.data.id, {
                workflow_template_id: 'repo-explorer',
                workflow_template_snapshot: template.data
              })
              ElMessage.success(t('project.explorationTaskCreated'))
            }
          }
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
  router.push(`/kanban/${project.id}`)
}

watch(() => dialogVisible.value, (newValue) => {
  if (!newValue) {
    editingProject.value = null
  }
})
</script>

<style scoped>
.project-list-view {
  overflow-y: auto;
}

.project-home {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 100%;
}

.brand-banner {
  padding: 4px 0 0;
}

.brand-wordmark {
  display: inline-block;
  margin: 0;
  font-size: 36px;
  line-height: 1;
  font-weight: 800;
  letter-spacing: -0.035em;
  color: #25C6C9;
}

.home-header {
  overflow: hidden;
}

.home-header__inner {
  border-bottom: 1px solid var(--border-color);
  align-items: center;
}

.workspace-panel {
  overflow: hidden;
}

.workspace-panel__header {
  border-bottom: 1px solid var(--border-color);
}

.workspace-panel__count {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--surface-tint-strong);
  color: var(--accent-color-strong);
  font-size: 12px;
  font-weight: 600;
}

.workspace-panel__body {
  padding: 20px;
}

.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.empty-workspace {
  min-height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px;
  text-align: center;
  border: 1px dashed var(--border-color);
  border-radius: 12px;
  background: var(--bg-secondary);
}

.empty-workspace__icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  color: var(--accent-color-strong);
  background: var(--surface-tint-strong);
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

</style>
