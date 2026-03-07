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

    <el-row v-else :gutter="20" class="project-grid">
      <el-col v-for="project in projects" :key="project.id" :xs="24" :sm="12" :md="8" :lg="6">
        <el-card class="project-card" shadow="hover" @click="openProject(project)">
          <template #header>
            <div class="card-header">
              <el-icon size="24"><Folder /></el-icon>
              <el-dropdown trigger="click">
                <el-button link @click.stop>
                  <el-icon><MoreFilled /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click="showEditDialog(project)">
                      <el-icon><Edit /></el-icon>
                      {{ $t('common.edit') }}
                    </el-dropdown-item>
                    <el-dropdown-item divided @click="handleDelete(project)">
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
              <el-tag v-if="project.repoUrl" size="small" type="info">
                <el-icon><Link /></el-icon>
                Git
              </el-tag>
              <span class="created-time">
                {{ formatDate(project.createdAt) }}
              </span>
            </div>
          </template>
        </el-card>
      </el-col>
    </el-row>

    <!-- Create/Edit Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEditing ? $t('project.editProject') : $t('project.createProject')"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
      >
        <el-form-item :label="$t('project.projectName')" prop="name">
          <el-input v-model="form.name" :placeholder="$t('project.enterName')" />
        </el-form-item>

        <el-form-item :label="$t('project.description')">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            :placeholder="$t('project.enterDescription')"
          />
        </el-form-item>

        <el-divider>
          <el-icon><Link /></el-icon>
          {{ $t('project.gitRepositoryOptional') }}
        </el-divider>

        <el-form-item :label="$t('project.repositoryUrl')">
          <el-input
            v-model="form.repoUrl"
            placeholder="https://github.com/user/repo.git"
            clearable
          >
            <template #prefix>
              <el-icon><Link /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item :label="$t('project.localPath')">
          <el-input
            v-model="form.localPath"
            placeholder="/path/to/local/repo"
            clearable
          >
            <template #prefix>
              <el-icon><FolderOpened /></el-icon>
            </template>
          </el-input>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          {{ isEditing ? $t('common.save') : $t('common.create') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Folder, FolderOpened, Edit, Delete, MoreFilled, Link } from '@element-plus/icons-vue'
import { useProjectStore } from '../stores/projectStore'

const { t } = useI18n()
const router = useRouter()
const projectStore = useProjectStore()

const loading = computed(() => projectStore.loading)
const projects = computed(() => projectStore.projects)

const dialogVisible = ref(false)
const isEditing = ref(false)
const editingId = ref(null)
const submitting = ref(false)
const formRef = ref(null)

const form = ref({
  name: '',
  description: '',
  repoUrl: '',
  localPath: ''
})

const rules = {
  name: [
    { required: true, message: t('validation.required'), trigger: 'blur' }
  ]
}

onMounted(() => {
  projectStore.fetchProjects()
})

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString()
}

const resetForm = () => {
  form.value = {
    name: '',
    description: '',
    repoUrl: '',
    localPath: ''
  }
  editingId.value = null
  isEditing.value = false
}

const showCreateDialog = () => {
  resetForm()
  dialogVisible.value = true
}

const showEditDialog = (project) => {
  isEditing.value = true
  editingId.value = project.id
  form.value = {
    name: project.name || '',
    description: project.description || '',
    repoUrl: project.repoUrl || '',
    localPath: project.localPath || ''
  }
  dialogVisible.value = true
}

const handleSubmit = async () => {
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  submitting.value = true
  try {
    if (isEditing.value) {
      await projectStore.updateProject(editingId.value, form.value)
      ElMessage.success(t('project.updated'))
    } else {
      await projectStore.createProject(form.value)
      ElMessage.success(t('project.created'))
    }
    dialogVisible.value = false
    resetForm()
  } catch (e) {
    ElMessage.error(isEditing.value ? t('project.updateFailed') : t('project.createFailed'))
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
</script>

<style scoped>
.project-list-view {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
}

.project-grid {
  margin-top: 24px;
}

.project-card {
  cursor: pointer;
  height: 100%;
  margin-bottom: 20px;
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
  line-height: 1.4;
  height: 40px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.created-time {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
