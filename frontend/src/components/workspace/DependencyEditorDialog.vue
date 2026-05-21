<template>
  <el-dialog
    :model-value="visible"
    title="编辑依赖关系"
    width="80%"
    top="6vh"
    append-to-body
    :close-on-click-modal="false"
    @update:model-value="(v) => !v && emit('close')"
  >
    <div class="dep-editor">
      <div class="dep-editor-canvas">
        <VueFlow
          v-model:nodes="flowNodes"
          v-model:edges="flowEdges"
          :node-types="nodeTypes"
          :default-edge-options="{ type: 'smoothstep', animated: false }"
          fit-view-on-init
          @connect="onConnect"
        >
          <Background pattern-color="#aaa" :gap="16" />
        </VueFlow>
      </div>
      <div class="dep-editor-hint">
        从节点右侧拖拽到另一节点左侧创建依赖；选中边按 Delete 键删除。
      </div>
    </div>
    <template #footer>
      <el-button @click="emit('close')">取消</el-button>
      <el-button type="primary" :loading="saving" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch, markRaw } from 'vue'
import { ElDialog, ElButton, ElMessage } from 'element-plus'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import DependencyTaskNode from './DependencyTaskNode.vue'
import { updateTaskDependencies } from '../../api/task.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  pipelineRootId: { type: Number, default: null },
  nodes: { type: Array, default: () => [] },
})

const emit = defineEmits(['close', 'saved'])

const nodeTypes = { task: markRaw(DependencyTaskNode) }
const flowNodes = ref([])
const flowEdges = ref([])
const saving = ref(false)

function computeLayout(nodes) {
  const idSet = new Set(nodes.map((n) => n.id))
  const depth = new Map()
  for (const n of nodes) depth.set(n.id, 0)
  let changed = true
  let max = nodes.length * nodes.length + 1
  while (changed && max-- > 0) {
    changed = false
    for (const n of nodes) {
      const preds = [...(n.depends_on || [])]
      for (const p of preds) {
        if (!idSet.has(p)) continue
        const d = (depth.get(p) ?? 0) + 1
        if (d > (depth.get(n.id) ?? 0)) {
          depth.set(n.id, d)
          changed = true
        }
      }
    }
  }
  const layers = new Map()
  for (const n of nodes) {
    const d = depth.get(n.id) ?? 0
    if (!layers.has(d)) layers.set(d, [])
    layers.get(d).push(n)
  }
  const COL_W = 240
  const ROW_H = 100
  const positions = new Map()
  for (const [d, layer] of layers) {
    layer.forEach((n, i) => {
      positions.set(n.id, { x: d * COL_W, y: i * ROW_H })
    })
  }
  return positions
}

function rebuild() {
  const positions = computeLayout(props.nodes || [])
  flowNodes.value = (props.nodes || []).map((n) => ({
    id: String(n.id),
    type: 'task',
    position: positions.get(n.id) || { x: 0, y: 0 },
    data: { task: n },
  }))
  const edges = []
  for (const n of props.nodes || []) {
    for (const dep of n.depends_on || []) {
      edges.push({
        id: `e-${dep}-${n.id}`,
        source: String(dep),
        target: String(n.id),
      })
    }
  }
  flowEdges.value = edges
}

watch(() => [props.visible, props.nodes], ([v]) => {
  if (v) rebuild()
}, { immediate: true })

function onConnect(connection) {
  const id = `e-${connection.source}-${connection.target}`
  if (flowEdges.value.some((e) => e.id === id)) return
  if (connection.source === connection.target) return
  flowEdges.value = [
    ...flowEdges.value,
    { id, source: connection.source, target: connection.target },
  ]
}

async function save() {
  if (!props.pipelineRootId) return
  saving.value = true
  try {
    const edges = flowEdges.value.map((e) => ({
      from: Number(e.source),
      to: Number(e.target),
    }))
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
.dep-editor {
  display: flex;
  flex-direction: column;
  height: 70vh;
}
.dep-editor-canvas {
  flex: 1;
  border: 1px solid var(--border-color, #e4e7ed);
  border-radius: 4px;
  overflow: hidden;
  background: var(--bg-secondary, #f5f7fa);
}
.dep-editor-hint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-secondary, #909399);
}
</style>
