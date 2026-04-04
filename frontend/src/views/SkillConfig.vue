<template>
  <div class="skill-config page-shell">
    <!-- 顶部操作栏 -->
    <div class="header page-header page-header--compact">
      <h1 class="page-header__title">{{ $t('skill.title') }}</h1>
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
      <div class="skill-list-panel">
        <div class="panel-header">
          <h3>{{ $t('skill.skillList') }}</h3>
          <span class="skill-count">{{ skillStore.skills.length }}</span>
        </div>
        <div class="skill-list" v-if="!skillStore.loading">
          <div
            class="skill-list-item"
            v-for="skill in skillStore.skills"
            :key="skill.id"
            :class="{ 'active': selectedSkill?.id === skill.id }"
            @click="selectSkill(skill)"
          >
            <div class="skill-item-info">
              <span class="skill-name">{{ skill.name }}</span>
            </div>
            <div class="skill-item-meta">
              <span class="skill-description-preview">{{ truncateDescription(skill.description) }}</span>
            </div>
          </div>
          <div v-if="skillStore.skills.length === 0" class="empty-list">
            {{ $t('skill.noSkills') }}
          </div>
        </div>
        <div v-else class="loading-state">
          {{ $t('common.loading') }}
        </div>
      </div>

      <!-- 右侧：技能详情面板 -->
      <div class="skill-detail-panel">
        <!-- 空状态：未选中技能 -->
        <div v-if="!selectedSkill" class="empty-detail">
          <p>{{ $t('skill.selectSkillHint') }}</p>
        </div>

        <!-- 详情内容 -->
        <div v-else class="detail-content">
          <!-- 技能头部信息 -->
          <div class="detail-header">
            <div class="skill-title-row">
              <div class="title-left">
                <h2>{{ selectedSkill.name }}</h2>
              </div>
              <div class="header-actions">
                <button class="btn btn-secondary btn-sm" @click="openEditForm">
                  {{ $t('common.edit') }}
                </button>
                <button class="btn btn-danger btn-sm" @click="confirmDelete">
                  {{ $t('common.delete') }}
                </button>
              </div>
            </div>
          </div>

          <!-- 技能基本信息 -->
          <div class="info-section">
            <div class="info-item">
              <span class="info-label">{{ $t('skill.description') }}</span>
              <span class="info-value description-text">{{ selectedSkill.description || '-' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">{{ $t('skill.createdAt') }}</span>
              <span class="info-value">{{ formatDate(selectedSkill.created_at) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">{{ $t('skill.updatedAt') }}</span>
              <span class="info-value">{{ formatDate(selectedSkill.updated_at) }}</span>
            </div>
          </div>

          <!-- 文件管理区域 -->
          <div class="files-section">
            <div class="section-header">
              <span class="section-label">{{ $t('skill.files') }}</span>
              <div class="section-actions">
                <button class="btn btn-secondary btn-sm" @click="refreshFiles">
                  {{ $t('common.refresh') }}
                </button>
                <button class="btn btn-primary btn-sm" @click="triggerFileUpload">
                  {{ $t('skill.uploadZip') }}
                </button>
                <input
                  ref="fileInputRef"
                  type="file"
                  accept=".zip"
                  style="display: none"
                  @change="handleZipUpload"
                />
              </div>
            </div>

            <!-- 文件浏览器 -->
            <div class="file-browser">
              <div class="file-tree-container">
                <el-tree
                  ref="fileTreeRef"
                  :data="fileTreeData"
                  :props="treeProps"
                  node-key="id"
                  :expand-on-click-node="false"
                  :default-expand-all="false"
                  highlight-current
                  @node-click="handleTreeNodeClick"
                >
                  <template #default="{ node, data }">
                    <span class="tree-node">
                      <span class="node-icon" :class="{ 'is-file': data.isLeaf, 'is-folder': !data.isLeaf }">{{ data.isLeaf ? getFileIcon(node.label) : '' }}</span>
                      <span class="node-label">{{ node.label }}</span>
                    </span>
                  </template>
                </el-tree>
                <div v-if="fileTreeData.length === 0" class="empty-files">
                  {{ $t('skill.noFiles') }}
                </div>
              </div>

              <!-- 文件预览 -->
              <div class="file-preview">
                <div v-if="selectedFile" class="preview-content">
                  <div class="preview-header">
                    <span class="preview-filename">{{ selectedFile.label }}</span>
                  </div>
                  <pre class="preview-code" v-if="previewContent">{{ previewContent }}</pre>
                  <div v-else-if="loadingPreview" class="loading-preview">
                    {{ $t('common.loading') }}
                  </div>
                  <div v-else class="empty-preview">
                    {{ $t('skill.cannotPreview') }}
                  </div>
                </div>
                <div v-else class="empty-preview-hint">
                  <p>{{ $t('skill.selectFileToPreview') }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Form Modal -->
    <div class="modal-overlay" v-if="showForm" @click.self="closeForm">
      <div class="modal">
        <div class="modal-header">
          <h2>{{ editingSkill ? $t('skill.editSkill') : $t('skill.createSkill') }}</h2>
          <button class="close-btn" @click="closeForm">&times;</button>
        </div>

        <div class="modal-body">
          <form data-testid="skill-form" @submit.prevent="saveSkill">
            <div class="form-group">
              <label>{{ $t('skill.skillName') }}</label>
              <input
                v-model="form.name"
                data-testid="skill-name-input"
                type="text"
                required
                :placeholder="$t('skill.namePlaceholder')"
              />
            </div>

            <div class="form-group">
              <label>{{ $t('skill.description') }}</label>
              <textarea
                v-model="form.description"
                data-testid="skill-description-input"
                :placeholder="$t('skill.descriptionPlaceholder')"
                rows="3"
              ></textarea>
            </div>

            <div class="form-actions">
              <button type="button" class="btn btn-secondary" @click="closeForm">
                {{ $t('common.cancel') }}
              </button>
              <button type="submit" class="btn btn-primary" :disabled="saving">
                {{ saving ? $t('common.loading') : $t('common.save') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Create Skill from ZIP Modal -->
    <div class="modal-overlay" v-if="showCreateDialog" @click.self="showCreateDialog = false">
      <div class="modal">
        <div class="modal-header">
          <h2>{{ $t('skill.createFromZip') }}</h2>
          <button class="close-btn" @click="showCreateDialog = false">&times;</button>
        </div>
        <div class="modal-body">
          <p class="modal-hint">{{ $t('skill.selectZipHint') }}</p>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" @click="showCreateDialog = false">
              {{ $t('common.cancel') }}
            </button>
            <button type="button" class="btn btn-primary" @click="triggerCreateFromZip">
              {{ $t('skill.selectZipFile') }}
            </button>
          </div>
        </div>
      </div>
    </div>
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
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSkillStore } from '../stores/skillStore'

const { t } = useI18n()
const skillStore = useSkillStore()

const saving = ref(false)
const showForm = ref(false)
const showCreateDialog = ref(false)
const editingSkill = ref(null)

const selectedSkill = ref(null)
const fileTreeData = ref([])
const selectedFile = ref(null)
const previewContent = ref('')
const loadingPreview = ref(false)

const fileInputRef = ref(null)
const createZipInputRef = ref(null)
const fileTreeRef = ref(null)

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

const getFileType = (filename) => {
  if (filename.endsWith('.md')) return 'markdown'
  if (filename.endsWith('.js') || filename.endsWith('.cjs')) return 'script'
  if (filename.endsWith('.sh')) return 'shell'
  if (filename.endsWith('.html')) return 'html'
  return 'other'
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

  // 排序：文件夹在前，文件在后
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

const treeProps = {
  children: 'children',
  label: 'label',
  isLeaf: 'isLeaf'
}

const handleTreeNodeClick = (data) => {
  if (data.isLeaf) {
    selectFile(data)
  }
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

const getFileIcon = (filename) => {
  if (filename.endsWith('.md')) return 'md'
  if (filename.endsWith('.js') || filename.endsWith('.cjs')) return 'js'
  if (filename.endsWith('.sh')) return 'sh'
  if (filename.endsWith('.html')) return 'html'
  return 'file'
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
  fileInputRef.value?.click()
}

const handleZipUpload = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return

  // Check if it's a zip file
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

  // Reset the input
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

const truncateDescription = (description) => {
  if (!description) return ''
  return description.length > 30 ? description.substring(0, 30) + '...' : description
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString()
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

    // Refresh skills list
    await skillStore.fetchSkills()

    // Select the created/updated skill
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

    // Select next available skill or clear
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

onMounted(loadSkills)
</script>

<style scoped>
@import '../styles/config-page.css';

.skill-config {
  padding: 0;
}

/* Left panel - Skill list */
.skill-list-panel {
  width: 300px;
  flex-shrink: 0;
  background: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.skill-count {
  background: var(--accent-color-soft);
  color: var(--accent-color);
  padding: 3px 9px;
  border-radius: 999px;
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.skill-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  background: var(--panel-bg);
}

.skill-list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 8px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
}

.skill-list-item:hover {
  background: var(--bg-secondary);
  border-color: rgba(99, 102, 241, 0.35);
}

.skill-list-item.active {
  background: var(--hover-bg);
  border: 1px solid var(--accent-color);
  box-shadow: inset 0 0 0 1px rgba(99, 102, 241, 0.1);
}

.skill-item-info {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.skill-name {
  font-weight: 600;
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-item-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.skill-description-preview {
  font-size: 10px;
  color: var(--text-secondary);
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Right panel - Skill detail */
.skill-detail-panel {
  flex: 1;
  background: var(--panel-bg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.skill-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.skill-title-row h2 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--text-primary);
}

/* Skill-specific overrides for info section */
.info-item {
  align-items: flex-start;
}

.info-label {
  width: 100px;
}

/* Files section */
.files-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px 20px;
  overflow: hidden;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-actions {
  display: flex;
  gap: 8px;
}

.file-browser {
  flex: 1;
  display: flex;
  gap: 16px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
}

.file-list {
  width: 200px;
  flex-shrink: 0;
  overflow-y: auto;
  padding: 8px;
  background: var(--bg-primary);
  border-right: 1px solid var(--border-color);
}

.file-tree-container {
  width: 240px;
  min-width: 240px;
  overflow-y: auto;
  padding: 8px;
  background: var(--bg-primary);
  border-right: 1px solid var(--border-color);
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
}

.node-icon {
  font-size: 11px;
  min-width: 20px;
  text-align: center;
}

.node-icon.is-file {
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border-radius: 3px;
  padding: 1px 4px;
  font-size: 10px;
  font-weight: 500;
  font-family: monospace;
}

.node-icon.is-folder {
  min-width: 0;
}

.node-label {
  font-size: 13px;
  color: var(--text-primary);
}

:deep(.el-tree-node__content) {
  height: 28px;
}

:deep(.el-tree-node.is-current > .el-tree-node__content) {
  background-color: rgba(64, 158, 255, 0.1);
}

.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
}

.file-item:hover {
  background: var(--bg-secondary);
}

.file-item.active {
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid var(--accent-color);
}

.file-icon {
  font-size: 14px;
}

.file-name {
  font-size: 12px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-files {
  text-align: center;
  padding: 1rem;
  color: var(--text-secondary);
  font-size: 12px;
}

.file-preview {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-primary);
}

.preview-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.preview-filename {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
}

.preview-code {
  flex: 1;
  margin: 0;
  padding: 12px;
  font-size: 12px;
  line-height: 1.6;
  overflow: auto;
  background: var(--bg-primary);
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.loading-preview,
.empty-preview,
.empty-preview-hint {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 13px;
}

.empty-preview-hint p {
  font-size: 13px;
  color: var(--text-secondary);
}

</style>
