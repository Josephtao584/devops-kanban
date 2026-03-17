<template>
  <div class="project-list-view">
    <el-page-header @back="router.push('/')">
      <template #content>
        <span class="page-title">{{ $t('project.title') }}</span>
      </template>
      <template #extra>
        <el-button type="primary" @click="showCreateDialog">
          <el-icon><Plus /></el-icon>
          {{ $t('project.newProject') }}
        </el-button>
      </template>
    </el-page-header>

    <el-skeleton v-if="loading" :rows="5" animated />

    <el-empty v-else-if="projects.length === 0" :description="$t('project.noProjects')">
      <el-button type="primary" @click="showCreateDialog">{{ $t('project.createFirst') }}</el-button>
    </el-empty>

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

    <!-- Create/Edit Dialog -->
    <ProjectFormDialog
      v-model="dialogVisible"
      :project="editingProject"
      :loading="submitting"
      @submit="handleSubmit"
      @cancel="resetForm"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useProjectStore } from '../stores/projectStore'
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
      await projectStore.createProject(formData)
      ElMessage.success(t('project.created'))
    }
    dialogVisible.value = false
    editingProject.value = null
  } catch (e) {
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
  } catch (e) {
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
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  height: 100%;
  overflow-y: auto;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
}

.project-grid {
  margin-top: 24px;
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}
</style>
