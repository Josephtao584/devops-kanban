<template>
  <div class="skill-config page-shell">
    <!-- 顶部操作栏 -->
    <div class="header page-header page-header--compact">
      <h1 class="page-header__title">{{ $t('skill.title') }}</h1>
      <button class="btn btn-primary" data-testid="open-create-skill" @click="openAddForm">
        + {{ $t('skill.createSkill') }}
      </button>
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
              <div class="file-list">
                <div
                  v-for="file in skillFiles"
                  :key="file.path"
                  class="file-item"
                  :class="{ 'active': selectedFile?.path === file.path }"
                  @click="selectFile(file)"
                >
                  <span class="file-icon">{{ getFileIcon(file.name) }}</span>
                  <span class="file-name">{{ file.name }}</span>
                </div>
                <div v-if="skillFiles.length === 0" class="empty-files">
                  {{ $t('skill.noFiles') }}
                </div>
              </div>

              <!-- 文件预览 -->
              <div class="file-preview">
                <div v-if="selectedFile" class="preview-content">
                  <div class="preview-header">
                    <span class="preview-filename">{{ selectedFile.name }}</span>
                    <button class="btn btn-secondary btn-sm" @click="editFile">
                      {{ $t('common.edit') }}
                    </button>
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

    <!-- Edit File Modal -->
    <div class="modal-overlay" v-if="showFileEdit" @click.self="closeFileEdit">
      <div class="modal modal--wide">
        <div class="modal-header">
          <h2>{{ $t('skill.editFile') }}: {{ editingFileName }}</h2>
          <button class="close-btn" @click="closeFileEdit">&times;</button>
        </div>

        <div class="modal-body">
          <textarea
            v-model="editingFileContent"
            class="file-editor"
            :placeholder="$t('skill.fileContentPlaceholder')"
            rows="15"
          ></textarea>

          <div class="form-actions">
            <button type="button" class="btn btn-secondary" @click="closeFileEdit">
              {{ $t('common.cancel') }}
            </button>
            <button type="button" class="btn btn-primary" :disabled="savingFile" @click="saveFileContent">
              {{ savingFile ? $t('common.loading') : $t('common.save') }}
            </button>
          </div>
        </div>
      </div>
    </div>

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
const editingSkill = ref(null)

const selectedSkill = ref(null)
const skillFiles = ref([])
const selectedFile = ref(null)
const previewContent = ref('')
const loadingPreview = ref(false)

const showFileEdit = ref(false)
const editingFileName = ref('')
const editingFileContent = ref('')
const savingFile = ref(false)

const fileInputRef = ref(null)

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

const loadSkillFiles = async () => {
  if (!selectedSkill.value) return

  try {
    const files = await skillStore.fetchSkillFiles(selectedSkill.value.id)
    skillFiles.value = files.map(path => {
      const name = path.split('/').pop()
      return {
        name,
        path,
        type: name.endsWith('.md') ? 'markdown' : name.endsWith('.js') || name.endsWith('.cjs') ? 'script' : 'other'
      }
    })
  } catch (e) {
    console.error('Failed to load skill files:', e)
    showToast(t('skill.loadFilesFailed'), 'error')
    skillFiles.value = []
  }
}

const getMockSkillFiles = (skillName) => {
  // Return mock files based on known skills
  const skillFileMap = {
    'brainstorming': [
      { name: 'SKILL.md', path: 'SKILL.md', type: 'markdown' },
      { name: 'spec-document-reviewer-prompt.md', path: 'spec-document-reviewer-prompt.md', type: 'markdown' },
      { name: 'visual-companion.md', path: 'visual-companion.md', type: 'markdown' },
      { name: 'scripts/helper.js', path: 'scripts/helper.js', type: 'script' },
      { name: 'scripts/server.cjs', path: 'scripts/server.cjs', type: 'script' }
    ],
    'systematic-debugging': [
      { name: 'SKILL.md', path: 'SKILL.md', type: 'markdown' }
    ],
    'writing-skills': [
      { name: 'SKILL.md', path: 'SKILL.md', type: 'markdown' }
    ]
  }

  return skillFileMap[skillName] || [
    { name: 'SKILL.md', path: 'SKILL.md', type: 'markdown' }
  ]
}

const getFileIcon = (filename) => {
  if (filename.endsWith('.md')) return '📄'
  if (filename.endsWith('.js') || filename.endsWith('.cjs')) return '📜'
  if (filename.endsWith('.sh')) return '⚡'
  if (filename.endsWith('.html')) return '🌐'
  return '📎'
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
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
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
      response = await skillStore.updateSkill(editingSkill.value.id, data.description)
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
    const skillName = editingSkill.value ? editingSkill.value.name : form.value.name
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
      skillFiles.value = []
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

const editFile = () => {
  if (!selectedFile.value) return
  editingFileName.value = selectedFile.value.name
  editingFileContent.value = previewContent.value
  showFileEdit.value = true
}

const closeFileEdit = () => {
  showFileEdit.value = false
  editingFileName.value = ''
  editingFileContent.value = ''
}

const saveFileContent = async () => {
  savingFile.value = true
  try {
    await skillStore.updateSkillFile(selectedSkill.value.id, editingFileName.value, editingFileContent.value)
    // Refresh preview
    if (selectedFile.value && selectedFile.value.name === editingFileName.value) {
      previewContent.value = editingFileContent.value
    }
    showToast(t('skill.fileSaved'))
    closeFileEdit()
  } catch (e) {
    console.error('Failed to save file:', e)
    showToast(t('skill.fileSaveFailed'), 'error')
  } finally {
    savingFile.value = false
  }
}

onMounted(loadSkills)
</script>

<style scoped>
.skill-config {
  padding: 0;
}

.header {
  align-items: center;
}

.header .btn {
  min-height: 36px;
}

/* Main content wrapper - left-right split */
.main-content-wrapper {
  display: flex;
  gap: var(--page-gap);
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: var(--page-padding);
  background: var(--bg-secondary);
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

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  background: var(--panel-bg);
}

.panel-header h3 {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-primary);
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

.empty-list, .loading-state {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
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

.empty-detail {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  background: var(--panel-bg);
}

.empty-detail p {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.detail-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  background: var(--panel-bg);
}

.detail-header {
  padding: 18px 20px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  background: var(--panel-bg);
}

.skill-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title-left {
  display: flex;
  align-items: center;
}

.skill-title-row h2 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  gap: 10px;
}

.header-actions .btn {
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 600;
  transition: all 0.2s;
}

/* Info section */
.info-section {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  background: var(--panel-bg);
}

.info-item {
  display: flex;
  align-items: flex-start;
  padding: 8px 0;
}

.info-item:not(:last-child) {
  border-bottom: 1px solid var(--border-color);
}

.info-label {
  width: 100px;
  flex-shrink: 0;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
}

.info-value {
  color: var(--text-primary);
  font-size: 13px;
}

.description-text {
  word-break: break-word;
  line-height: 1.5;
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

.section-label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.3px;
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

/* Buttons */
.btn {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
}

.btn-primary {
  background: var(--accent-color);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--bg-tertiary);
  border-color: var(--border-color);
}

.btn-danger {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.btn-danger:hover:not(:disabled) {
  background: #fee2e2;
  border-color: #fca5a5;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal {
  background: var(--bg-primary);
  border-radius: 8px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  animation: slideUp 0.3s ease;
}

.modal--wide {
  max-width: 700px;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.modal-header h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
}

.close-btn:hover {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

.modal-body {
  padding: 16px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  font-size: 13px;
  color: var(--text-primary);
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 13px;
  transition: all 0.2s;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.form-group input:hover,
.form-group select:hover,
.form-group textarea:hover {
  border-color: var(--border-color);
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
}

.file-editor {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 12px;
  font-family: monospace;
  line-height: 1.6;
  background: var(--bg-primary);
  color: var(--text-primary);
  resize: vertical;
}

.file-editor:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

/* Toast */
.toast {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 10px 16px;
  border-radius: 6px;
  color: white;
  font-size: 13px;
  font-weight: 500;
  z-index: 2000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  animation: slideInRight 0.3s ease;
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(100px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.toast.success {
  background: #10b981;
}

.toast.error {
  background: #ef4444;
}
</style>
