<template>
  <div>
    <div v-if="showSearch" class="file-tree-search">
      <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"></circle>
        <path d="m21 21-4.3-4.3"></path>
      </svg>
      <input
        v-model="filterText"
        type="text"
        placeholder="Search files..."
        class="search-input"
      />
      <button v-if="filterText" class="search-clear" @click="filterText = ''">&times;</button>
    </div>
    <div class="file-tree">
      <template v-for="child in filteredRootChildren" :key="child.path">
        <FileTreeNode
          :node="child"
          :selected-path="selectedPath"
          :depth="0"
          :max-depth="maxDepth"
          :filter-text="filterText"
          @file-select="$emit('file-select', $event)"
        />
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import FileTreeNode from './FileTreeNode.vue'

const props = defineProps({
  tree: { type: Object, required: true },
  selectedPath: { type: String, default: '' },
  maxDepth: { type: Number, default: Infinity },
  showSearch: { type: Boolean, default: true },
})

defineEmits(['file-select'])

const filterText = ref('')

function matchesFilter(node) {
  if (!filterText.value) return true
  const text = filterText.value.toLowerCase()
  if (node.name.toLowerCase().includes(text)) return true
  if (node.children) return node.children.some(matchesFilter)
  return false
}

const filteredRootChildren = computed(() => {
  if (!filterText.value) return props.tree.children
  return (props.tree.children || []).filter(matchesFilter)
})
</script>

<style scoped>
.file-tree-search {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.search-icon {
  flex-shrink: 0;
  color: #909399;
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 13px;
  background: transparent;
  color: inherit;
}

.search-input::placeholder {
  color: #c0c4cc;
}

.search-clear {
  flex-shrink: 0;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  color: #909399;
  line-height: 1;
  padding: 0 2px;
}

.search-clear:hover {
  color: #606266;
}

.file-tree {
  overflow-y: auto;
  font-size: 13px;
  line-height: 1.6;
}
</style>
