<template>
  <div class="knowledge-card" :class="{ 'is-empty': !hasFiles && !loading }">
    <div class="knowledge-card__header">
      <div class="knowledge-card__title">
        <span class="knowledge-card__icon">📚</span>
        <span class="knowledge-card__name" :title="project.name">{{ project.name }}</span>
      </div>
      <span v-if="hasFiles" class="knowledge-card__count">{{ totalFiles }} 个文件</span>
    </div>

    <div class="knowledge-card__body">
      <div v-if="loading" class="knowledge-card__hint">加载中...</div>
      <div v-else-if="error" class="knowledge-card__hint knowledge-card__hint--error">
        {{ error }}
      </div>
      <div v-else-if="!hasFiles" class="knowledge-card__hint">
        知识仓为空或未配置本地路径
      </div>
      <ul v-else class="knowledge-card__list">
        <li
          v-for="entry in previewEntries"
          :key="entry.path"
          class="knowledge-card__entry"
          :class="{ 'is-dir': entry.type === 'directory' }"
          :title="entry.path"
        >
          <span class="knowledge-card__entry-icon">
            {{ entry.type === 'directory' ? '📁' : '📄' }}
          </span>
          <span class="knowledge-card__entry-name">{{ entry.name }}</span>
        </li>
        <li v-if="extraCount > 0" class="knowledge-card__entry knowledge-card__entry--more">
          ... 还有 {{ extraCount }} 项
        </li>
      </ul>
    </div>

    <div v-if="hasFiles" class="knowledge-card__footer">
      <button class="knowledge-card__open" @click="$emit('open', project)">
        阅读完整知识库 →
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { getProjectFileTree } from '../../api/project.js'

const props = defineProps({
  project: { type: Object, required: true },
  previewLimit: { type: Number, default: 8 },
})

defineEmits(['open'])

const tree = ref(null)
const loading = ref(false)
const error = ref('')

const topLevel = computed(() => Array.isArray(tree.value?.children) ? tree.value.children : [])
const previewEntries = computed(() => topLevel.value.slice(0, props.previewLimit))
const extraCount = computed(() => Math.max(0, topLevel.value.length - props.previewLimit))
const hasFiles = computed(() => topLevel.value.length > 0)

const totalFiles = computed(() => {
  let count = 0
  const walk = (node) => {
    if (!node) return
    if (node.type === 'file') {
      count += 1
      return
    }
    if (Array.isArray(node.children)) {
      node.children.forEach(walk)
    }
  }
  topLevel.value.forEach(walk)
  return count
})

async function loadTree() {
  if (!props.project?.id) return
  loading.value = true
  error.value = ''
  try {
    const resp = await getProjectFileTree(props.project.id)
    if (resp?.success) {
      tree.value = resp.data
    } else {
      error.value = resp?.message || '加载失败'
      tree.value = null
    }
  } catch (e) {
    error.value = e?.message || '加载失败'
    tree.value = null
  } finally {
    loading.value = false
  }
}

watch(() => props.project?.id, loadTree, { immediate: true })
</script>

<style scoped>
.knowledge-card {
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 14px 16px;
  background: linear-gradient(180deg, rgba(255, 244, 214, 0.5) 0%, rgba(255, 250, 240, 0.7) 100%);
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 8px 16px;
}

.knowledge-card.is-empty {
  background: var(--bg-secondary, #fafafa);
}

.knowledge-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.knowledge-card__title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.knowledge-card__icon {
  font-size: 16px;
  flex-shrink: 0;
}

.knowledge-card__name {
  font-weight: 600;
  font-size: 13px;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.knowledge-card__count {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  background: rgba(0, 0, 0, 0.04);
  padding: 2px 8px;
  border-radius: 999px;
  flex-shrink: 0;
}

.knowledge-card__body {
  font-size: 12px;
}

.knowledge-card__hint {
  color: var(--el-text-color-secondary);
  padding: 4px 0;
}

.knowledge-card__hint--error {
  color: var(--el-color-danger);
}

.knowledge-card__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.knowledge-card__entry {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 4px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--el-text-color-regular);
  overflow: hidden;
}

.knowledge-card__entry-icon {
  flex-shrink: 0;
}

.knowledge-card__entry-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.knowledge-card__entry.is-dir .knowledge-card__entry-name {
  font-weight: 500;
}

.knowledge-card__entry--more {
  color: var(--el-text-color-secondary);
  font-style: italic;
}

.knowledge-card__footer {
  display: flex;
  justify-content: flex-end;
}

.knowledge-card__open {
  border: none;
  background: transparent;
  color: var(--accent-color-strong, #d97706);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 0;
}

.knowledge-card__open:hover {
  text-decoration: underline;
}
</style>
