<template>
  <div class="file-tree">
    <template v-for="child in tree.children" :key="child.path">
      <FileTreeNode
        :node="child"
        :selected-path="selectedPath"
        :depth="0"
        @file-select="$emit('file-select', $event)"
      />
    </template>
  </div>
</template>

<script setup>
import FileTreeNode from './FileTreeNode.vue'

defineProps({
  tree: { type: Object, required: true },
  selectedPath: { type: String, default: '' },
})

defineEmits(['file-select'])
</script>

<style scoped>
.file-tree {
  overflow-y: auto;
  font-size: 13px;
  line-height: 1.6;
}
</style>
