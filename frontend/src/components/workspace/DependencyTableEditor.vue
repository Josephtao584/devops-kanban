<template>
  <el-dialog
    :model-value="visible"
    title="编辑依赖关系"
    width="720px"
    top="8vh"
    append-to-body
    :close-on-click-modal="false"
    @update:model-value="(v) => !v && emit('close')"
  >
    <div class="dep-editor-hint">
      为每个任务选择它的前置任务（depends_on）。保存时后端会校验是否存在环路。
    </div>
    <el-table :data="rows" border stripe size="small" max-height="60vh">
      <el-table-column label="任务" min-width="220">
        <template #default="{ row }">
          <span class="dep-row-status">{{ statusIcon(row.task) }}</span>
          <span>{{ row.task.title }}</span>
        </template>
      </el-table-column>
      <el-table-column label="前置任务" min-width="320">
        <template #default="{ row }">
          <el-select
            v-model="row.depsInPipeline"
            multiple
            collapse-tags
            collapse-tags-tooltip
            filterable
            placeholder="无前置"
            style="width: 100%"
          >
            <el-option
              v-for="opt in optionsFor(row.task.id)"
              :key="opt.id"
              :label="opt.title"
              :value="opt.id"
            />
          </el-select>
        </template>
      </el-table-column>
    </el-table>
    <template #footer>
      <el-button @click="emit('close')">取消</el-button>
      <el-button type="primary" :loading="saving" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { updateTaskDependencies } from '../../api/task.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  pipelineRootId: { type: Number, default: null },
  nodes: { type: Array, default: () => [] },
})

const emit = defineEmits(['close', 'saved'])

// rows: [{ task, depsInPipeline }] — depsInPipeline 仅包含 pipeline 内的依赖；
// pipeline 外的依赖在保存时不通过 edges 传给后端（后端会自动保留）。
const rows = ref([])
const saving = ref(false)

function rebuild() {
  const list = props.nodes || []
  const idSet = new Set(list.map((n) => n.id))
  rows.value = list.map((n) => ({
    task: n,
    depsInPipeline: (n.depends_on || []).filter((d) => idSet.has(d)),
  }))
}

watch(() => props.visible, (v) => {
  if (v) rebuild()
})

const idToTitle = computed(() => {
  const m = new Map()
  for (const n of props.nodes || []) m.set(n.id, n.title)
  return m
})

function optionsFor(currentId) {
  return (props.nodes || [])
    .filter((n) => n.id !== currentId)
    .map((n) => ({ id: n.id, title: n.title }))
}

function statusIcon(t) {
  if (t.status === 'DONE') return '✓'
  if (t.status === 'IN_PROGRESS') return '▶'
  if (t.status === 'BLOCKED') return '✗'
  if (t.status === 'CANCELLED') return '⊘'
  return '○'
}

async function save() {
  if (saving.value) return
  if (!props.pipelineRootId) return
  saving.value = true
  try {
    const edges = []
    for (const r of rows.value) {
      for (const upstreamId of r.depsInPipeline || []) {
        edges.push({ from: upstreamId, to: r.task.id })
      }
    }
    const res = await updateTaskDependencies(props.pipelineRootId, edges)
    if (res.success) {
      ElMessage.success('依赖关系已更新')
      emit('saved')
      emit('close')
    } else {
      ElMessage.error(res.message || '保存失败')
    }
  } catch (err) {
    const msg = err?.response?.data?.message || err?.message || '保存失败'
    ElMessage.error(msg)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.dep-editor-hint {
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--text-secondary, #909399);
}
.dep-row-status {
  display: inline-block;
  width: 18px;
  text-align: center;
  margin-right: 4px;
  color: var(--text-secondary, #909399);
}
</style>
