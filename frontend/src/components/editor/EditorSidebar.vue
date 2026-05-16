<template>
  <div class="editor-sidebar">
    <div class="sidebar-tabs">
      <button :class="['sidebar-tab', { active: activeTab === 'changes' }]" @click.stop="emit('tab-change', 'changes')">
        变更{{ changedFiles.length ? `(${changedFiles.length})` : '' }}
      </button>
      <button :class="['sidebar-tab', { active: activeTab === 'files' }]" @click.stop="emit('tab-change', 'files')">
        文件
      </button>
    </div>

    <!-- 文件 Tab -->
    <div v-show="activeTab === 'files'" class="sidebar-content">
      <div class="file-search-wrap">
        <input v-model="localSearchQuery" placeholder="搜索文件..." class="file-search" />
      </div>

      <div v-if="recentFiles.length" class="sidebar-section">
        <div class="section-header" @click.stop="emit('toggle-recent')">
          <span>最近</span>
          <span class="section-toggle">{{ showRecent ? '▾' : '▸' }}</span>
        </div>
        <div v-show="showRecent" class="section-body">
          <div
            v-for="f in localFilteredRecentFiles"
            :key="f"
            class="file-item"
            :class="{ selected: currentFile === f }"
            :title="f"
            @click.stop="emit('open-file', f)"
          >
            <span class="file-name">{{ localFileName(f) }}</span>
            <span class="file-dir">{{ localFileDir(f) }}</span>
          </div>
        </div>
      </div>

      <div class="sidebar-section">
        <div class="section-header" @click.stop="emit('toggle-tree')">
          <span>文件树</span>
          <span class="section-toggle">{{ showFullTree ? '▾' : '▸' }}</span>
        </div>
        <div v-show="showFullTree" class="section-body">
          <FileTree
            v-if="fileTree"
            :tree="fileTree"
            :selected-path="currentFile"
            @file-select="(f) => emit('open-file', f)"
          />
          <div v-else class="loading-tree">加载中...</div>
        </div>
      </div>
    </div>

    <!-- 变更 Tab -->
    <div v-show="activeTab === 'changes'" class="sidebar-content">
      <div v-if="loading" class="sidebar-empty">加载中...</div>
      <div v-else-if="changedFiles.length === 0" class="sidebar-empty">无未提交变更</div>
      <div v-else class="changes-list">
        <div
          v-for="f in changedFiles"
          :key="f.path"
          class="change-item"
          :class="{ selected: currentFile === f.path }"
        >
          <span class="change-status" :class="localStatusClass(f.status)">{{ localStatusLabel(f.status) }}</span>
          <span class="change-path" :title="f.path" @click.stop="emit('open-changed-file', f)">{{ f.path }}</span>
          <button class="change-diff-btn" title="查看差异" @click.stop="emit('show-diff', f)">差异</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import FileTree from './FileTree.vue'

const props = defineProps({
  activeTab: { type: String, default: 'changes' },
  fileTree: { type: Object, default: null },
  currentFile: { type: String, default: '' },
  recentFiles: { type: Array, default: () => [] },
  changedFiles: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  showRecent: { type: Boolean, default: true },
  showFullTree: { type: Boolean, default: true },
  searchQuery: { type: String, default: '' }
})

const emit = defineEmits([
  'tab-change', 'toggle-recent', 'toggle-tree',
  'open-file', 'open-changed-file', 'show-diff',
  'update:search-query'
])

const localSearchQuery = computed({
  get: () => props.searchQuery,
  set: (val) => emit('update:search-query', val)
})

const localFilteredRecentFiles = computed(() => {
  if (!props.searchQuery) return props.recentFiles.slice()
  const q = props.searchQuery.toLowerCase()
  return props.recentFiles.filter(f => f.toLowerCase().includes(q))
})

function localFileName(filePath) {
  return filePath.split('/').pop()
}

function localFileDir(filePath) {
  const parts = filePath.split('/')
  parts.pop()
  return parts.join('/')
}

function localStatusClass(status) {
  const map = { added: 'status-added', modified: 'status-modified', deleted: 'status-deleted', untracked: 'status-untracked' }
  return map[status] || 'status-modified'
}

function localStatusLabel(status) {
  const map = { added: 'A', modified: 'M', deleted: 'D', untracked: '?' }
  return map[status] || status?.[0]?.toUpperCase() || '?'
}
</script>

<style scoped>
.editor-sidebar {
  width: 260px;
  min-width: 200px;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  background: #fafafa;
  overflow: hidden;
}

.sidebar-tabs {
  display: flex;
  border-bottom: 1px solid #e4e7ed;
  background: #f0f2f5;
  flex-shrink: 0;
}

.sidebar-tab {
  flex: 1;
  padding: 8px 4px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 12px;
  color: #606266;
  transition: all 0.2s;
  border-bottom: 2px solid transparent;
}

.sidebar-tab:hover {
  background: #e8eaed;
}

.sidebar-tab.active {
  color: #409eff;
  border-bottom-color: #409eff;
  background: #fafafa;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.file-search-wrap {
  padding: 4px 8px 8px;
}

.file-search {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 12px;
  outline: none;
  box-sizing: border-box;
}

.file-search:focus {
  border-color: #409eff;
}

.sidebar-section {
  margin-bottom: 4px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 12px;
  cursor: pointer;
  font-size: 11px;
  color: #909399;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  user-select: none;
}

.section-header:hover {
  background: #f0f2f5;
}

.section-toggle {
  font-size: 10px;
}

.section-body {
  padding: 0 4px;
}

.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 12px;
  border-radius: 3px;
  margin: 0 4px;
}

.file-item:hover {
  background: #ecf5ff;
}

.file-item.selected {
  background: #d9ecff;
  color: #409eff;
}

.file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 1;
  min-width: 0;
}

.file-dir {
  font-size: 10px;
  color: #c0c4cc;
  margin-left: 8px;
  flex-shrink: 0;
}

.sidebar-empty {
  padding: 24px 16px;
  text-align: center;
  color: #909399;
  font-size: 13px;
}

.changes-list {
  padding: 0 4px;
}

.change-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  font-size: 12px;
  border-radius: 3px;
  margin: 1px 4px;
}

.change-item.selected {
  background: #d9ecff;
}

.change-status {
  display: inline-block;
  width: 16px;
  height: 16px;
  line-height: 16px;
  text-align: center;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
}

.status-added {
  background: #e1f3d8;
  color: #67c23a;
}

.status-modified {
  background: #d9ecff;
  color: #409eff;
}

.status-deleted {
  background: #fde2e2;
  color: #f56c6c;
}

.status-untracked {
  background: #f4f4f5;
  color: #909399;
}

.change-path {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  cursor: pointer;
}

.change-path:hover {
  color: #409eff;
}

.change-diff-btn {
  flex-shrink: 0;
  padding: 1px 6px;
  font-size: 10px;
  border: 1px solid #dcdfe6;
  border-radius: 3px;
  background: #fff;
  color: #606266;
  cursor: pointer;
}

.change-diff-btn:hover {
  color: #409eff;
  border-color: #409eff;
}

.loading-tree {
  padding: 20px;
  text-align: center;
  color: #909399;
}
</style>
