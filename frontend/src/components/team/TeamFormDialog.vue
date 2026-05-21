<template>
  <BaseDialog
    v-model="visible"
    :title="isEditing ? $t('team.editTeam') : $t('team.createTeam')"
    width="720px"
  >
    <el-tabs v-model="activeTab" type="border-card" class="team-form-tabs">
      <el-tab-pane :label="$t('team.basicInfo')" name="basic">
        <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
          <el-form-item :label="$t('team.teamName')" prop="name">
            <el-input v-model="form.name" :placeholder="$t('team.enterName')" maxlength="200" show-word-limit />
          </el-form-item>
          <el-form-item :label="$t('team.description')">
            <el-input
              v-model="form.description"
              type="textarea"
              :rows="3"
              :placeholder="$t('team.enterDescription')"
              maxlength="5000"
              show-word-limit
            />
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane v-if="isEditing" :label="$t('team.projectTab')" name="projects">
        <div class="projects-tab">
          <div class="projects-tab-header">
            <span class="projects-tab-title">{{ $t('team.manageProjects', '管理项目') }}</span>
            <el-button size="small" type="primary" @click="openAddDialog">
              <el-icon><Plus /></el-icon>
              {{ $t('team.addProject') }}
            </el-button>
          </div>

          <div v-if="projectsLoading" class="projects-tab-loading">
            <el-icon class="is-loading" :size="18"><Loading /></el-icon>
          </div>

          <div v-else-if="teamProjects.length" class="projects-tab-list">
            <div
              v-for="proj in teamProjects"
              :key="proj.id"
              class="project-row"
            >
              <div class="project-row-info">
                <el-icon class="project-row-icon"><Folder /></el-icon>
                <span class="project-row-name">{{ proj.name }}</span>
              </div>
              <span class="project-row-role" :class="proj.repo_role === 'knowledge' ? 'role-knowledge' : 'role-dev'">
                {{ proj.repo_role === 'knowledge' ? '知识仓库' : '开发仓库' }}
              </span>
              <el-button size="small" text @click="openEditProject(proj)">
                <el-icon><Edit /></el-icon>
              </el-button>
              <el-button size="small" text type="danger" @click="handleRemoveProject(proj)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </div>

          <div v-else class="projects-tab-empty">
            {{ $t('team.noProjectsInTeam') }}
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <template #footer>
      <el-button @click="handleCancel">{{ $t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="loading" @click="handleSubmit">
        {{ isEditing ? $t('common.save') : $t('common.create') }}
      </el-button>
    </template>

    <!-- Add project to team dialog (lazy mount) -->
    <el-dialog
      v-if="isEditing"
      v-model="addProjectDialogVisible"
      :title="$t('team.addProjectToTeam')"
      width="480px"
      top="15vh"
      :append-to-body="true"
      :show-close="true"
      :destroy-on-close="true"
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
        <el-button @click="addProjectDialogVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button
          type="primary"
          :disabled="!addForm.projectId"
          :loading="addingProject"
          @click="handleAddProject"
        >
          确认添加
        </el-button>
      </template>
    </el-dialog>

    <!-- Edit project dialog (lazy mount via v-if) -->
    <ProjectFormDialog
      v-if="editingProjectDialogVisible"
      v-model="editingProjectDialogVisible"
      :project="editingProject"
      :loading="editingProjectLoading"
      :append-to-body="true"
      @submit="handleEditProjectSubmit"
    />
  </BaseDialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Loading, Folder, Setting, Reading, Edit, Delete } from '@element-plus/icons-vue'
import BaseDialog from '../BaseDialog.vue'
import ProjectFormDialog from '../project/ProjectFormDialog.vue'
import { useProjectStore } from '../../stores/projectStore'
import * as teamApi from '../../api/team'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  team: { type: Object, default: null },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'submit', 'cancel'])

const { t } = useI18n()
const projectStore = useProjectStore()

const formRef = ref(null)
const form = ref({ name: '', description: '' })
const rules = { name: [{ required: true, message: t('validation.required'), trigger: 'blur' }] }
const activeTab = ref('basic')

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const isEditing = computed(() => !!props.team?.id)

// Project management state
const teamProjects = ref([])
const projectsLoading = ref(false)
const addProjectDialogVisible = ref(false)
const addForm = ref({ projectId: null, repoRole: 'development' })
const addingProject = ref(false)
const editingProjectDialogVisible = ref(false)
const editingProject = ref(null)
const editingProjectLoading = ref(false)
const projectsLoaded = ref(false)

// Filter against local snapshot, not reactive store
const availableProjects = computed(() => {
  const allProjects = projectStore.projects || []
  const teamId = props.team?.id
  const teamProjectIds = teamProjects.value.map(p => p.id)
  return allProjects.filter(p => (!p.team_id || p.team_id === teamId) && !teamProjectIds.includes(p.id))
})

// Single watch for form + projects sync
watch(() => props.team, async (team) => {
  if (team) {
    form.value = { name: team.name || '', description: team.description || '' }
  } else {
    form.value = { name: '', description: '' }
  }
}, { immediate: true })

// Load projects only when dialog opens (not on form changes)
watch(() => props.modelValue, async (visible) => {
  if (visible && props.team?.id) {
    await loadTeamProjects()
    if (!projectsLoaded.value) {
      await projectStore.fetchProjects()
      projectsLoaded.value = true
    }
    activeTab.value = 'basic'
  } else if (!visible) {
    teamProjects.value = []
    activeTab.value = 'basic'
  }
})

async function loadTeamProjects() {
  if (!props.team?.id) return
  projectsLoading.value = true
  try {
    const resp = await teamApi.getTeam(props.team.id)
    if (resp?.data?.projects) {
      teamProjects.value = resp.data.projects
    } else {
      teamProjects.value = []
    }
  } catch {
    teamProjects.value = []
  } finally {
    projectsLoading.value = false
  }
}

async function handleAddProject() {
  if (!addForm.value.projectId) return
  addingProject.value = true
  try {
    await teamApi.addProjectToTeam(props.team.id, {
      project_id: addForm.value.projectId,
      repo_role: addForm.value.repoRole
    })
    addForm.value = { projectId: null, repoRole: 'development' }
    addProjectDialogVisible.value = false
    await loadTeamProjects()
    await projectStore.fetchProjects()
    emit('refresh')
  } catch {
    // Error handled by API
  } finally {
    addingProject.value = false
  }
}

async function handleRemoveProject(proj) {
  try {
    await ElMessageBox.confirm(
      t('team.removeProjectConfirm', { name: proj.name }),
      t('team.removeProject'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
    await teamApi.removeProjectFromTeam(props.team.id, proj.id)
    await loadTeamProjects()
    await projectStore.fetchProjects()
    emit('refresh')
    ElMessage.success(t('team.projectRemoved', '项目已移除'))
  } catch {
    // Cancelled or API error
  }
}

function openEditProject(proj) {
  editingProject.value = proj
  editingProjectDialogVisible.value = true
}

async function handleEditProjectSubmit(formData) {
  if (!editingProject.value) return
  editingProjectLoading.value = true
  try {
    await projectStore.updateProject(editingProject.value.id, formData)
    editingProjectDialogVisible.value = false
    await loadTeamProjects()
    await projectStore.fetchProjects()
    emit('refresh')
    ElMessage.success(t('project.updated'))
  } catch {
    // Error handled by store
  } finally {
    editingProjectLoading.value = false
  }
}

function openAddDialog() {
  addProjectDialogVisible.value = true
}

const handleSubmit = async () => {
  try {
    await formRef.value.validate()
    emit('submit', { name: form.value.name, description: form.value.description || undefined })
  } catch { /* validation failed */ }
}

const handleCancel = () => {
  emit('cancel')
  emit('update:modelValue', false)
}
</script>

<style scoped>
.team-form-tabs :deep(.el-tabs__header) {
  margin: 0;
  padding: 0 20px;
  border-bottom: none;
}

.team-form-tabs :deep(.el-tabs__content) {
  padding: 16px 20px;
}

.projects-tab {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 200px;
}

.projects-tab-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.projects-tab-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.projects-tab-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  color: var(--el-text-color-secondary);
}

.projects-tab-empty {
  text-align: center;
  padding: 32px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px dashed var(--border-color);
}

.projects-tab-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.project-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.project-row-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.project-row-icon {
  color: var(--accent-color);
  flex-shrink: 0;
}

.project-row-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-row-role {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
  flex-shrink: 0;
}

.project-row-role.role-knowledge {
  color: #e6a23c;
  background: rgba(230, 162, 60, 0.1);
}

.project-row-role.role-dev {
  color: var(--done-strong);
  background: rgba(37, 198, 201, 0.1);
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
