<template>
  <div class="skill-config page-shell">
    <!-- 顶部操作栏 -->
    <div class="header page-header page-header--compact">
      <div class="page-header__content">
        <h1 class="page-header__title">{{ $t('skill.title') }}</h1>
        <p class="page-header__description page-description">{{ $t('skill.pageDescription') }}</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" data-testid="open-create-skill-from-zip" @click="showCreateDialog = true">
          {{ $t('skill.createFromZip') }}
        </button>
        <button class="btn btn-primary" data-testid="open-create-skill" @click="openAddForm">
          + {{ $t('skill.createSkill') }}
        </button>
      </div>
    </div>

    <!-- 主内容区：左右分栏 -->
    <div class="main-content-wrapper">
      <!-- 左侧：技能列表 -->
      <SkillListSidebar
        :skills="filteredSkills"
        :selected-id="selectedSkill?.id"
        :loading="skillStore.loading"
        :selected-template-id="selectedTemplateId"
        :templates="workflowTemplates"
        @select="selectSkill"
        @update:selected-template-id="selectedTemplateId = $event"
        @reorder="handleReorder"
      />

      <!-- 右侧：技能详情面板 -->
      <SkillDetailPanel
        v-if="selectedSkill"
        ref="detailPanelRef"
        :skill="selectedSkill"
        :file-tree-data="fileTreeData"
        :selected-file="selectedFile"
        :preview-content="previewContent"
        :loading-preview="loadingPreview"
        @edit="openEditForm"
        @delete="confirmDelete"
        @refresh-files="refreshFiles"
        @upload-zip="triggerFileUpload"
        @handle-zip-upload="handleZipUpload"
        @select-file="selectFile"
      />

      <!-- 空状态：未选中技能 -->
      <div v-else class="empty-detail">
        <p>{{ $t('skill.selectSkillHint') }}</p>
      </div>
    </div>

    <!-- Add/Edit Form Dialog -->
    <SkillFormDialog
      :visible="showForm"
      :is-edit="!!editingSkill"
      :form="form"
      :saving="saving"
      @update:visible="showForm = $event"
      @save="saveSkill"
      @close="closeForm"
    />

    <!-- Create Skill from ZIP Modal -->
    <BaseDialog
      v-model="showCreateDialog"
      :title="$t('skill.createFromZip')"
      width="400px"
    >
      <p class="modal-hint">{{ $t('skill.selectZipHint') }}</p>
      <template #footer>
        <el-button @click="showCreateDialog = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="triggerCreateFromZip">{{ $t('skill.selectZipFile') }}</el-button>
      </template>
    </BaseDialog>
    <input
      ref="createZipInputRef"
      type="file"
      accept=".zip"
      style="display: none"
      @change="handleCreateFromZip"
    />

    <!-- Toast Notification -->
    <div v-if="toast.show" class="toast" :class="toast.type">
      {{ toast.message }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSkillStore } from '../stores/skillStore'
import { useAgentStore } from '../stores/agentStore'
import { useWorkflowTemplateStore } from '../stores/workflowTemplateStore'
import { filterSkillsByTemplate } from '../utils/skillWorkflowFilter'
import BaseDialog from '../components/BaseDialog.vue'
import SkillListSidebar from '../components/skill/SkillListSidebar.vue'
import SkillDetailPanel from '../components/skill/SkillDetailPanel.vue'
import SkillFormDialog from '../components/skill/SkillFormDialog.vue'

const { t } = useI18n()
const skillStore = useSkillStore()
const agentStore = useAgentStore()
const workflowTemplateStore = useWorkflowTemplateStore()

const selectedTemplateId = ref('')
const workflowTemplates = computed(() => workflowTemplateStore.templates)

const filteredSkills = computed(() =>
  filterSkillsByTemplate(
    skillStore.skills,
    workflowTemplates.value,
    agentStore.agents,
    selectedTemplateId.value
  )
)

const saving = ref(false)
const showForm = ref(false)
const showCreateDialog = ref(false)
const editingSkill = ref(null)

const selectedSkill = ref(null)
const fileTreeData = ref([])
const selectedFile = ref(null)
const previewContent = ref('')
const loadingPreview = ref(false)

const createZipInputRef = ref(null)
const detailPanelRef = ref(null)

const form = ref({
  name: '',
  description: ''
})

const toast = ref({ show: false, message: '', type: 'success' })

const showToast = (message, type = 'success') => {
  toast.value = { show: true, message, type }
  setTimeout(() => { toast.value.show = false }, 3000)
}

const resetFormState = () => {
  form.value = {
    name: '',
    description: ''
  }
}

const loadSkills = async () => {
  try {
    await skillStore.fetchSkills()
    if (skillStore.skills.length > 0 && !selectedSkill.value) {
      selectSkill(skillStore.skills[0])
    }
    agentStore.fetchAgents().catch(() => {})
    workflowTemplateStore.fetchTemplates().catch(() => {})
  } catch (e) {
    console.error('Failed to load skills:', e)
    showToast(t('skill.loadFailed'), 'error')
  }
}

const selectSkill = async (skill) => {
  selectedSkill.value = skill
  selectedFile.value = null
  previewContent.value = ''
  await loadSkillFiles()
}

/**
 * 将扁平路径数组转换为目录树结构
 */
const buildFileTree = (files) => {
  const root = { label: 'root', children: [], isLeaf: false, path: '' }

  files.forEach(filePath => {
    const parts = filePath.split('/')
    let currentNode = root

    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1
      const fullPath = parts.slice(0, index + 1).join('/')

      if (isFile) {
        let existing = currentNode.children.find(c => c.path === fullPath)
        if (!existing) {
          existing = {
            label: part,
            path: fullPath,
            isLeaf: true,
            type: getFileType(part),
            id: fullPath
          }
          currentNode.children.push(existing)
        }
      } else {
        let folder = currentNode.children.find(c => c.path === fullPath)
        if (!folder) {
          folder = {
            label: part,
            path: fullPath,
            isLeaf: false,
            children: [],
            id: fullPath
          }
          currentNode.children.push(folder)
        }
        currentNode = folder
      }
    })
  })

  const sortChildren = (node) => {
    if (node.children) {
      node.children.sort((a, b) => {
        if (a.isLeaf !== b.isLeaf) return a.isLeaf ? 1 : -1
        return a.label.localeCompare(b.label)
      })
      node.children.forEach(sortChildren)
    }
  }
  sortChildren(root)

  return root.children
}

const getFileType = (filename) => {
  if (filename.endsWith('.md')) return 'markdown'
  if (filename.endsWith('.js') || filename.endsWith('.cjs')) return 'script'
  if (filename.endsWith('.sh')) return 'shell'
  if (filename.endsWith('.html')) return 'html'
  return 'other'
}

const loadSkillFiles = async () => {
  if (!selectedSkill.value) return

  try {
    const files = await skillStore.fetchSkillFiles(selectedSkill.value.id)
    fileTreeData.value = buildFileTree(files || [])
  } catch (e) {
    console.error('Failed to load skill files:', e)
    showToast(t('skill.loadFilesFailed'), 'error')
    fileTreeData.value = []
  }
}

const selectFile = async (file) => {
  selectedFile.value = file
  await loadFilePreview(file)
}

const loadFilePreview = async (file) => {
  loadingPreview.value = true
  previewContent.value = ''

  try {
    const result = await skillStore.fetchSkillFile(selectedSkill.value.id, file.path)
    previewContent.value = result.content || ''
  } catch (e) {
    console.error('Failed to load file preview:', e)
    previewContent.value = ''
  } finally {
    loadingPreview.value = false
  }
}

const refreshFiles = async () => {
  await loadSkillFiles()
  showToast(t('skill.filesRefreshed'))
}

const triggerFileUpload = () => {
  if (detailPanelRef.value) {
    detailPanelRef.value.fileInputRef?.click()
  }
}

const handleZipUpload = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return

  if (!file.name.endsWith('.zip')) {
    showToast(t('skill.invalidFileType'), 'error')
    event.target.value = ''
    return
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    const base64 = arrayBufferToBase64(arrayBuffer)
    await skillStore.uploadSkillZip(selectedSkill.value.id, base64)
    await loadSkillFiles()
    showToast(t('skill.zipUploaded'))
  } catch (e) {
    console.error('Failed to upload zip:', e)
    showToast(t('skill.zipUploadFailed'), 'error')
  }

  event.target.value = ''
}

const arrayBufferToBase64 = (arrayBuffer) => {
  const bytes = new Uint8Array(arrayBuffer)
  const chunkSize = 0x8000
  let binary = ''

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

const openAddForm = () => {
  editingSkill.value = null
  resetFormState()
  showForm.value = true
}

const triggerCreateFromZip = () => {
  createZipInputRef.value?.click()
}

const handleCreateFromZip = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return

  if (!file.name.endsWith('.zip')) {
    showToast(t('skill.invalidFileType'), 'error')
    event.target.value = ''
    return
  }

  saving.value = true
  try {
    const arrayBuffer = await file.arrayBuffer()
    const base64 = arrayBufferToBase64(arrayBuffer)
    const response = await skillStore.createSkillFromZip(base64)

    if (!response?.success) {
      showToast(response?.message || t('skill.createFailed'), 'error')
      return
    }

    await skillStore.fetchSkills()
    const newSkill = skillStore.skills.find(s => s.name === response.data.name)
    if (newSkill) {
      selectedSkill.value = newSkill
    }
    showToast(t('skill.createdFromZip'))
    showCreateDialog.value = false
  } catch (e) {
    console.error('Failed to create skill from zip:', e)
    showToast(e?.message || t('skill.createFailed'), 'error')
  } finally {
    saving.value = false
    event.target.value = ''
  }
}

const openEditForm = () => {
  if (!selectedSkill.value) return
  editingSkill.value = selectedSkill.value
  form.value = {
    name: selectedSkill.value.name,
    description: selectedSkill.value.description || ''
  }
  showForm.value = true
}

const saveSkill = async () => {
  saving.value = true
  try {
    const data = {
      name: form.value.name.trim(),
      description: form.value.description.trim() || undefined
    }

    let response
    if (editingSkill.value) {
      response = await skillStore.updateSkill(editingSkill.value.id, data)
    } else {
      response = await skillStore.createSkill(data)
    }

    if (!response?.success) {
      showToast(response?.message || t('messages.saveFailed', { name: t('skill.title') }), 'error')
      return
    }

    await skillStore.fetchSkills()

    const skillName = editingSkill.value ? data.name : form.value.name
    const updatedSkill = skillStore.skills.find(s => s.name === skillName)
    if (updatedSkill) {
      selectedSkill.value = updatedSkill
    }

    closeForm()
    showToast(t('messages.saved', { name: t('skill.title') }))
  } catch (e) {
    console.error('Failed to save skill:', e)
    showToast(e?.message || t('messages.saveFailed', { name: t('skill.title') }), 'error')
  } finally {
    saving.value = false
  }
}

const confirmDelete = async () => {
  if (!selectedSkill.value) return
  if (!confirm(t('skill.deleteConfirm'))) return

  try {
    const response = await skillStore.deleteSkill(selectedSkill.value.id)
    if (!response?.success) {
      showToast(response?.message || t('messages.deleteFailed', { name: t('skill.title') }), 'error')
      return
    }

    if (skillStore.skills.length > 0) {
      selectSkill(skillStore.skills[0])
    } else {
      selectedSkill.value = null
      fileTreeData.value = []
    }

    showToast(t('messages.deleted', { name: t('skill.title') }))
  } catch (e) {
    showToast(e?.message || t('messages.deleteFailed', { name: t('skill.title') }), 'error')
  }
}

const closeForm = () => {
  showForm.value = false
  editingSkill.value = null
}

const handleReorder = async (evt) => {
  const newOrder = filteredSkills.value.map(s => s.id)
  try {
    await skillStore.reorderSkills(newOrder)
  } catch (e) {
    console.error('Failed to reorder skills:', e)
    showToast(t('skill.reorderFailed'), 'error')
  }
}

onMounted(loadSkills)
</script>

<style scoped>
@import '../styles/config-page.css';

.skill-config {
  padding: 0;
}

.empty-detail {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 14px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--panel-bg);
}

.modal-hint {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}
</style>
