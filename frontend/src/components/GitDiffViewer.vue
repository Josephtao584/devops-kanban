<template>
  <div class="git-diff-viewer">
    <div class="commit-main-content">
      <div class="file-panel">
        <div class="panel-header">
          <span class="panel-title">文件更改</span>
          <span v-if="selectable" class="file-count">{{ selectedCount }} / {{ fileItems.length }}</span>
        </div>

        <div class="file-list">
          <div
            v-for="file in fileItems"
            :key="file.path"
            :class="['file-item', { selected: !!file.selected, active: selectedFilePath === file.path }]"
            @click="$emit('update:selectedFilePath', file.path)"
          >
            <el-checkbox
              v-if="selectable"
              :model-value="file.selected"
              @click.stop
              @change="$emit('toggle-file', file.path)"
            />
            <div class="file-info">
              <span class="file-path" :title="file.path">{{ file.displayName }}</span>
            </div>
            <el-tag :type="getStatusType(file.status)" size="small">{{ getStatusLabel(file.status) }}</el-tag>
          </div>

          <div v-if="fileItems.length === 0 && !loading" class="empty-files">
            <span>暂无文件更改</span>
          </div>
        </div>

        <div v-if="selectable" class="file-actions">
          <el-button size="small" link @click="$emit('select-all')">全选</el-button>
          <el-button size="small" link @click="$emit('deselect-all')">取消全选</el-button>
        </div>
      </div>

      <div class="diff-panel">
        <div class="panel-header">
          <span class="panel-title">{{ title }}</span>
          <span v-if="selectedFilePath" class="selected-file">{{ selectedFilePath }}</span>
        </div>

        <div v-if="loading" class="diff-loading">
          <span>加载中...</span>
        </div>

        <el-empty v-else-if="!selectedFilePath" description="选择文件查看差异" />

        <div v-else-if="!currentDiff" class="diff-empty">
          <span>无差异或无法显示</span>
        </div>

        <div v-else class="diff-content">
          <div class="diff-stats">
            <span v-if="currentFileAdditions > 0" class="stat-add">+{{ currentFileAdditions }}</span>
            <span v-if="currentFileDeletions > 0" class="stat-del">-{{ currentFileDeletions }}</span>
          </div>
          <el-scrollbar class="diff-scrollbar">
            <div class="diff-view">
              <div
                v-for="(line, idx) in parsedDiff"
                :key="idx"
                :class="['diff-line', line.type]"
              >{{ line.content }}</div>
            </div>
          </el-scrollbar>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  fileItems: {
    type: Array,
    default: () => []
  },
  diffsByPath: {
    type: Object,
    default: () => ({})
  },
  loading: {
    type: Boolean,
    default: false
  },
  selectedFilePath: {
    type: String,
    default: ''
  },
  selectable: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: '代码差异'
  }
})

defineEmits(['update:selectedFilePath', 'toggle-file', 'select-all', 'deselect-all'])

const selectedCount = computed(() => props.fileItems.filter(file => file.selected).length)

const currentDiff = computed(() => {
  if (!props.selectedFilePath) return ''
  return props.diffsByPath?.[props.selectedFilePath] || ''
})

const currentFile = computed(() => props.fileItems.find(file => file.path === props.selectedFilePath) || null)

const currentFileAdditions = computed(() => currentFile.value?.additions || 0)
const currentFileDeletions = computed(() => currentFile.value?.deletions || 0)

const parsedDiff = computed(() => {
  if (!currentDiff.value) return []
  const lines = currentDiff.value.split('\n')
  const result = []
  let oldLineNum = 0
  let newLineNum = 0

  for (const line of lines) {
    if (line.startsWith('diff --git') ||
        line.startsWith('index ') ||
        line.startsWith('--- ') ||
        line.startsWith('+++ ')) {
      if (line.startsWith('--- ') || line.startsWith('+++ ')) {
        result.push({ type: 'header', content: line })
      } else if (line.trim()) {
        result.push({ type: 'other', content: line })
      }
      continue
    }

    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/)
      if (match) {
        oldLineNum = parseInt(match[1])
        newLineNum = parseInt(match[2])
      }
      result.push({ type: 'hunk', content: line })
      continue
    }

    if (line.startsWith('+')) {
      result.push({ type: 'addition', content: line.substring(1), lineNum: newLineNum++ })
    } else if (line.startsWith('-')) {
      result.push({ type: 'deletion', content: line.substring(1), lineNum: oldLineNum++ })
    } else if (line.startsWith(' ')) {
      result.push({ type: 'context', content: line.substring(1), lineNum: newLineNum++ })
    } else if (line.trim()) {
      result.push({ type: 'other', content: line })
    }
  }

  return result
})

const getStatusType = (status) => {
  const types = {
    added: 'success',
    modified: 'warning',
    deleted: 'danger',
    untracked: 'success'
  }
  return types[status] || 'warning'
}

const getStatusLabel = (status) => {
  if (status === 'deleted') return '删除'
  if (status === 'modified') return '修改'
  return '新增'
}
</script>

<style scoped>
.commit-main-content {
  display: flex;
  gap: 16px;
  height: 500px;
  min-height: 350px;
  overflow: hidden;
  box-sizing: border-box;
  max-width: 100%;
  background: #fff;
}

.file-panel {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  overflow: hidden;
  min-width: 0;
  box-sizing: border-box;
  height: 100%;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  background: linear-gradient(135deg, #f8fafc 0%, rgba(37, 198, 201, 0.06) 100%);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-title::before {
  content: '';
  display: block;
  width: 4px;
  height: 16px;
  background: var(--accent-color);
  border-radius: 2px;
}

.file-count {
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.file-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 8px;
  margin-bottom: 4px;
  border: 1px solid transparent;
}

.file-item:hover {
  background: var(--bg-secondary);
  border-color: var(--border-color);
}

.file-item.selected,
.file-item.active {
  background: linear-gradient(135deg, rgba(37, 198, 201, 0.06) 0%, rgba(37, 198, 201, 0.12) 100%);
  border-color: var(--accent-color);
  box-shadow: 0 1px 4px rgba(37, 198, 201, 0.15);
}

.file-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.file-path {
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.empty-files {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 16px;
  color: var(--text-muted);
  font-size: 13px;
}

.file-actions {
  display: flex;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.diff-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  overflow: hidden;
  height: 100%;
}

.selected-file {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
  font-size: 12px;
  color: var(--text-secondary);
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  background: var(--bg-primary);
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.diff-loading,
.diff-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 40px;
  color: var(--text-muted);
  font-size: 14px;
}

.diff-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
  width: 100%;
}

.diff-stats {
  display: flex;
  gap: 10px;
  padding: 10px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.stat-add {
  color: var(--el-color-success);
  font-size: 12px;
  font-family: 'Monaco', 'Menlo', monospace;
  font-weight: 600;
  background: var(--el-color-success-light-9);
  padding: 2px 8px;
  border-radius: 6px;
}

.stat-del {
  color: var(--el-color-danger);
  font-size: 12px;
  font-family: 'Monaco', 'Menlo', monospace;
  font-weight: 600;
  background: var(--el-color-danger-light-9);
  padding: 2px 8px;
  border-radius: 6px;
}

.diff-scrollbar {
  flex: 1;
  overflow: auto;
  min-width: 0;
}

.diff-view {
  padding: 0;
  margin: 0;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre;
  overflow-x: auto;
  min-width: 0;
  width: 100%;
}

.diff-line {
  display: block;
  padding: 2px 20px;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  transition: background 0.15s ease;
}

.diff-line.addition {
  background-color: rgba(34, 197, 94, 0.12);
  color: #16a34a;
  border-left: 3px solid #22c55e;
}

.diff-line.deletion {
  background-color: rgba(239, 68, 68, 0.12);
  color: #dc2626;
  border-left: 3px solid #ef4444;
}

.diff-line.hunk {
  background-color: rgba(99, 102, 241, 0.1);
  color: #25C6C9;
  font-weight: 600;
  border-left: 3px solid #25C6C9;
}

.diff-line.header {
  color: var(--text-muted);
  font-style: italic;
  border-left: 3px solid transparent;
}

.diff-line.context,
.diff-line.other {
  border-left: 3px solid transparent;
}
</style>
