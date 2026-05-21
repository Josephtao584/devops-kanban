<template>
  <div class="skill-detail-panel">
    <div class="detail-content">
      <div class="detail-header">
        <div class="skill-title-row">
          <div class="title-left">
            <h2>{{ skill.name }}</h2>
            <span v-if="skill.created_at" class="meta-chip" :title="$t('skill.createdAt')">
              <span class="meta-chip__label">{{ $t('skill.createdAt') }}</span>
              <span class="meta-chip__value">{{ formatDateWithFallback(skill.created_at) }}</span>
            </span>
            <span v-if="skill.updated_at" class="meta-chip" :title="$t('skill.updatedAt')">
              <span class="meta-chip__label">{{ $t('skill.updatedAt') }}</span>
              <span class="meta-chip__value">{{ formatDateWithFallback(skill.updated_at) }}</span>
            </span>
          </div>
          <div class="header-actions">
            <button class="btn btn-secondary btn-sm" @click.stop="emit('edit')">{{ $t('common.edit') }}</button>
            <button class="btn btn-danger btn-sm" @click.stop="emit('delete')">{{ $t('common.delete') }}</button>
          </div>
        </div>
        <div class="skill-description-block">
          <span class="section-label">{{ $t('skill.description') }}</span>
          <p class="skill-description" :class="{ 'skill-description--empty': !skill.description }">
            {{ skill.description || $t('skill.noDescription', '暂无描述') }}
          </p>
        </div>
      </div>

      <div class="files-section">
        <div class="section-header">
          <span class="section-label">{{ $t('skill.files') }}</span>
          <div class="section-actions">
            <button class="btn btn-secondary btn-sm" @click.stop="emit('refresh-files')">{{ $t('common.refresh') }}</button>
            <button class="btn btn-primary btn-sm" @click.stop="emit('upload-zip')">{{ $t('skill.uploadZip') }}</button>
            <input
              ref="fileInputRef"
              type="file"
              accept=".zip"
              style="display: none"
              @change="emit('handle-zip-upload', $event)"
            />
          </div>
        </div>

        <div class="file-browser">
          <div class="file-tree-container">
            <el-tree
              :data="fileTreeData"
              :props="treeProps"
              :key="skill.id"
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
</template>

<script setup>
import { ref } from 'vue'
import { formatDate } from '../../utils/dateFormat'

const props = defineProps({
  skill: { type: Object, required: true },
  fileTreeData: { type: Array, default: () => [] },
  selectedFile: { type: Object, default: null },
  previewContent: { type: String, default: '' },
  loadingPreview: { type: Boolean, default: false }
})

const emit = defineEmits(['edit', 'delete', 'refresh-files', 'upload-zip', 'handle-zip-upload', 'select-file', 'load-preview'])

const fileInputRef = ref(null)

const treeProps = {
  children: 'children',
  label: 'label',
  isLeaf: 'isLeaf'
}

const getFileType = (filename) => {
  if (filename.endsWith('.md')) return 'markdown'
  if (filename.endsWith('.js') || filename.endsWith('.cjs')) return 'script'
  if (filename.endsWith('.sh')) return 'shell'
  if (filename.endsWith('.html')) return 'html'
  return 'other'
}

const getFileIcon = (filename) => {
  if (filename.endsWith('.md')) return 'md'
  if (filename.endsWith('.js') || filename.endsWith('.cjs')) return 'js'
  if (filename.endsWith('.sh')) return 'sh'
  if (filename.endsWith('.html')) return 'html'
  return 'file'
}

const handleTreeNodeClick = (data) => {
  if (data.isLeaf) {
    emit('select-file', data)
  }
}

const formatDateWithFallback = (dateStr) => formatDate(dateStr, { fallback: '-' })

// Expose fileInputRef for parent trigger
defineExpose({ fileInputRef })
</script>

<style scoped>
.skill-detail-panel {
  flex: 1;
  background: var(--panel-bg);
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.detail-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.skill-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}

.title-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.title-left h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 22px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 11px;
  background: var(--bg-tertiary, rgba(31, 41, 55, 0.04));
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.meta-chip__label {
  color: var(--text-muted, var(--text-secondary));
  font-weight: 600;
  letter-spacing: 0.02em;
}

.meta-chip__value {
  color: var(--text-primary);
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-weight: 500;
}

.skill-description-block {
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background: var(--bg-secondary, #fafbfc);
}

.skill-description-block .section-label {
  margin-bottom: 6px;
}

.section-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.skill-description {
  margin: 0;
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
}

.skill-description--empty {
  color: var(--text-muted, var(--text-secondary));
  font-style: italic;
}

.files-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px 20px;
  min-height: 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.section-actions {
  display: flex;
  gap: 8px;
}

.file-browser {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 0;
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
}

.file-tree-container {
  width: 240px;
  min-width: 240px;
  overflow-y: auto;
  padding: 6px;
  background: var(--bg-secondary, #fafbfc);
  border-right: 1px solid var(--border-color);
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
}

.node-icon {
  font-size: 11px;
  min-width: 22px;
  text-align: center;
}

.node-icon.is-file {
  color: var(--accent-color-strong, var(--accent-color));
  background: var(--accent-color-soft, rgba(37, 198, 201, 0.1));
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 9px;
  font-weight: 700;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  text-transform: uppercase;
  letter-spacing: 0.04em;
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
  border-radius: 6px;
  margin: 1px 0;
  transition: background-color 0.15s ease;
}

:deep(.el-tree-node__content:hover) {
  background-color: rgba(37, 198, 201, 0.06);
}

:deep(.el-tree-node.is-current > .el-tree-node__content) {
  background-color: rgba(37, 198, 201, 0.12);
}

:deep(.el-tree-node.is-current > .el-tree-node__content) .node-label {
  color: var(--accent-color-strong, var(--accent-color));
  font-weight: 600;
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
  padding: 8px 14px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary, #fafbfc);
}

.preview-filename {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  letter-spacing: 0;
}

.preview-code {
  flex: 1;
  margin: 0;
  padding: 14px 16px;
  font-size: 12px;
  line-height: 1.65;
  overflow: auto;
  background: var(--bg-primary);
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
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
