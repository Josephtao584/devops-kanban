<template>
  <div>
    <div
      class="file-tree-item"
      :class="{
        'is-directory': node.type === 'directory',
        'is-file': node.type === 'file',
        'is-selected': node.path === selectedPath,
      }"
      :data-path="node.path"
      :style="{ paddingLeft: `${depth * 16 + 8}px` }"
      @click="handleClick"
    >
      <svg v-if="node.type === 'directory'" class="tree-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline v-if="!expanded" points="9 18 15 12 9 6"></polyline>
        <polyline v-if="expanded" points="6 9 12 15 18 9"></polyline>
      </svg>
      <svg v-else class="tree-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
      </svg>
      <span class="file-name">{{ node.name }}</span>
    </div>

    <div v-if="expanded && node.children">
      <FileTreeNode
        v-for="child in filteredChildren"
        :key="child.path"
        :node="child"
        :selected-path="selectedPath"
        :depth="depth + 1"
        :max-depth="maxDepth"
        @file-select="$emit('file-select', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const emit = defineEmits(['file-select'])

const props = defineProps({
  node: { type: Object, required: true },
  selectedPath: { type: String, default: '' },
  depth: { type: Number, default: 0 },
  maxDepth: { type: Number, default: Infinity },
  filterText: { type: String, default: '' },
})

// Default: all collapsed. Auto-expand only when maxDepth is explicitly finite.
const expanded = ref(typeof props.maxDepth === 'number' && Number.isFinite(props.maxDepth) ? props.depth < props.maxDepth : false)

function handleClick() {
  if (props.node.type === 'directory') {
    expanded.value = !expanded.value
  } else {
    emit('file-select', props.node.path)
  }
}

// Filter children by search text; if any descendant matches, keep the directory
function matchesFilter(node) {
  if (!props.filterText) return true
  const text = props.filterText.toLowerCase()
  if (node.name.toLowerCase().includes(text)) return true
  if (node.children) return node.children.some(matchesFilter)
  return false
}

const filteredChildren = computed(() => {
  if (!props.filterText) return props.node.children
  return (props.node.children || []).filter(matchesFilter)
})
</script>

<style scoped>
.file-tree-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
  white-space: nowrap;
}

.file-tree-item:hover {
  background: rgba(0, 0, 0, 0.04);
}

.file-tree-item.is-selected {
  background: rgba(64, 158, 255, 0.15);
  color: #409eff;
}

.tree-icon {
  flex-shrink: 0;
  color: #909399;
}

.file-name {
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
