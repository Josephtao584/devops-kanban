<template>
  <div class="workflow-timeline" :class="{ 'is-collapsed': isCollapsed }">
    <!-- Workflow 标签 -->
    <span class="workflow-label">WORKFLOW</span>

    <!-- 工作流标题区 -->
    <div class="workflow-header">
      <div class="workflow-title">
        <el-icon class="workflow-icon"><Refresh /></el-icon>
        <h3>{{ workflow?.name || '团队协作流程' }}</h3>
        <!-- 启动按钮：仅待运行状态显示 -->
        <button
          v-if="isWorkflowPending"
          class="start-workflow-btn"
          @click="handleStartWorkflow"
          title="启动工作流"
        >
          ▶ 启动
        </button>
      </div>
      <div class="workflow-actions">
        <div class="workflow-progress" v-show="!isCollapsed">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: progress.percent + '%' }"></div>
          </div>
          <span class="progress-text">{{ progress.completed }}/{{ progress.total }} 完成</span>
        </div>
        <!-- 折叠/展开按钮 -->
        <button
          class="collapse-btn"
          @click="toggleCollapse"
          :title="isCollapsed ? '展开工作流' : '折叠工作流'"
        >
          <el-icon>
            <ArrowUp v-if="!isCollapsed" />
            <ArrowDown v-else />
          </el-icon>
        </button>
      </div>
    </div>

    <!-- 节点时间线 - 按阶段展示 -->
    <div class="timeline-container" ref="containerRef" v-show="!isCollapsed">
      <div class="timeline-scroll" ref="scrollRef" style="position: relative;">
        <!-- 正向流程连接线层 -->
        <svg class="forward-connectors" v-if="hasForwardConnectors" :style="svgStyle">
          <defs>
            <marker
              id="forward-arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#9ca3af" />
            </marker>
          </defs>
          <!-- 开始节点到第一个阶段的连接线 -->
          <path
            v-if="sortedStages.length > 0"
            :d="getForwardPath('start', sortedStages[0].id)"
            stroke="#9ca3af"
            stroke-width="2"
            fill="none"
            marker-end="url(#forward-arrowhead)"
          />
          <!-- 阶段间的连接线 -->
          <template v-for="(stage, index) in sortedStages" :key="'forward-' + stage.id">
            <path
              v-if="index < sortedStages.length - 1"
              :d="getForwardPath(stage.id, sortedStages[index + 1].id)"
              stroke="#9ca3af"
              stroke-width="2"
              fill="none"
              marker-end="url(#forward-arrowhead)"
            />
          </template>
          <!-- 最后一个阶段到结束节点的连接线 -->
          <path
            v-if="sortedStages.length > 0"
            :d="getForwardPath(sortedStages[sortedStages.length - 1].id, 'end')"
            stroke="#9ca3af"
            stroke-width="2"
            fill="none"
            marker-end="url(#forward-arrowhead)"
          />
        </svg>

        <div class="timeline-stages">
          <!-- 开始节点 -->
          <div class="stage-container origin-stage" ref="startNodeRef">
            <div class="origin-node start-node">
              <div class="origin-circle">
                <span class="origin-icon">▶</span>
              </div>
              <span class="origin-label">开始</span>
            </div>
          </div>

          <template v-for="(stage, stageIndex) in sortedStages" :key="stage.id">
            <!-- 阶段容器 -->
            <div class="stage-container" :class="{ 'is-parallel': stage.parallel }" :ref="el => setStageRef(el, stageIndex)">
              <!-- 父节点卡片 - 仅并行阶段显示 -->
              <div v-if="stage.parallel && getParentNode(stage)" class="parent-node-wrapper">
                <WorkflowNode
                  :node="getParentNode(stage)"
                  :is-current="false"
                  :is-selected="isParentSelected(stage)"
                  :is-parent-node="true"
                  @select="handleParentSelect($event, stage)"
                  @view-details="$emit('view-details', $event)"
                />
                <div class="parent-progress">
                  <span class="progress-label">进度:</span>
                  <span class="progress-value">{{ getStageProgress(stage) }}</span>
                </div>
              </div>

              <!-- 阶段标签 -->
              <div class="stage-label" v-if="stage.parallel">
                <el-icon class="parallel-icon"><Lightning /></el-icon>
                <span>并行</span>
              </div>

              <!-- 分支线（并行阶段开始） -->
              <div v-if="stage.parallel && stage.nodes.length > 1" class="branch-lines branch-start">
                <svg width="100%" height="20" viewBox="0 0 100 20">
                  <path d="M50 0 L50 10" stroke="#3b82f6" stroke-width="2" fill="none"/>
                  <path v-for="(node, idx) in stage.nodes" :key="'branch-'+idx"
                    :d="getBranchPath(idx, stage.nodes.length)"
                    :stroke="getNodeColor(node)"
                    stroke-width="2"
                    fill="none"/>
                </svg>
              </div>

              <!-- 节点组 -->
              <div class="stage-nodes" :class="{ 'parallel-nodes': stage.parallel && stage.nodes.length > 1 }">
                <template v-for="node in stage.nodes" :key="node.id">
                  <WorkflowNode
                    :node="node"
                    :is-current="node.id === workflow?.currentNodeId && node.status === 'IN_PROGRESS'"
                    :is-selected="node.id === selectedNodeId"
                    @select="$emit('select-node', $event)"
                    @view-details="$emit('view-details', $event)"
                  />
                </template>
              </div>

              <!-- 合并线（并行阶段结束） -->
              <div v-if="stage.parallel && stage.nodes.length > 1" class="branch-lines branch-end">
                <svg width="100%" height="20" viewBox="0 0 100 20">
                  <path v-for="(node, idx) in stage.nodes" :key="'merge-'+idx"
                    :d="getMergePath(idx, stage.nodes.length)"
                    :stroke="getNodeColor(node)"
                    stroke-width="2"
                    fill="none"/>
                </svg>
              </div>

              <!-- 阶段间连接线已移除，改用 SVG 绘制 -->
            </div>
          </template>

          <!-- 结束节点 -->
          <div class="stage-container origin-stage" ref="endNodeRef">
            <div class="origin-node end-node">
              <div class="origin-circle">
                <span class="origin-icon">✓</span>
              </div>
              <span class="origin-label">结束</span>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, nextTick, onUnmounted, onBeforeUnmount, shallowRef } from 'vue'
import { ElMessageBox } from 'element-plus'
import { Refresh, Lightning, ArrowUp, ArrowDown } from '@element-plus/icons-vue'
import WorkflowNode from './WorkflowNode.vue'
import { nodeStatusConfig } from '@/constants/workflowPresentation'
import { getWorkflowProgress, getAllNodes } from '@/utils/workflowRunViewModel'

const props = defineProps({
  workflow: {
    type: Object,
    default: null
  },
  selectedNodeId: {
    type: [Number, String],
    default: null
  },
  defaultCollapsed: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['select-node', 'start-workflow', 'view-details'])

// Collapse state
const isCollapsed = ref(false)

// Watch defaultCollapsed prop to initialize state
watch(() => props.defaultCollapsed, (val) => {
  isCollapsed.value = val
}, { immediate: true })

// Toggle collapse/expand
const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
}

// Expose toggle method for external control
defineExpose({ toggleCollapse })

// Node position cache for rollback arrows
const nodePositions = ref({})
const containerRef = ref(null)
const scrollRef = ref(null)

// Stage refs for DOM measurement
const stageRefs = ref([])

// Store measured stage positions
const stagePositions = ref([])

// Position of start and end nodes
const startNodePos = ref({ x: 0, y: 0, width: 0, height: 0 })
const endNodePos = ref({ x: 0, y: 0, width: 0, height: 0 })

// Refs for start and end nodes
const startNodeRef = ref(null)
const endNodeRef = ref(null)

// Resize observer for responsive updates
let resizeObserver = null
let workflowWatcher = null
let stageRefsWatcher = null

// SVG style for proper coordinate system
const svgStyle = computed(() => {
  if (!scrollRef.value) return {}
  const width = scrollRef.value.scrollWidth || '100%'
  const height = scrollRef.value.scrollHeight || 300
  return {
    width: width + 'px',
    height: height + 'px'
  }
})

const sortedStages = computed(() => {
  if (!props.workflow?.stages) return []
  return [...props.workflow.stages].sort((a, b) => a.order - b.order)
})

const progress = computed(() => {
  return getWorkflowProgress(props.workflow)
})

// Check if there are forward connectors to render
const hasForwardConnectors = computed(() => {
  return sortedStages.value.length > 0
})

// 判断工作流是否处于待运行状态（所有节点都是 PENDING 或 TODO）
const isWorkflowPending = computed(() => {
  if (!props.workflow?.stages) return false
  const allNodes = getAllNodes(props.workflow)
  if (allNodes.length === 0) return false
  return allNodes.every(node => node.status === 'PENDING' || node.status === 'TODO')
})

// 启动工作流
const handleStartWorkflow = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要启动此工作流吗？系统将按顺序执行各阶段任务节点。',
      '启动工作流',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'info'
      }
    )
    emit('start-workflow', props.workflow)
  } catch {
    // 用户取消操作
  }
}

const getNodeColor = (node) => {
  return nodeStatusConfig[node.status]?.color || '#6B7280'
}

// 计算分支线路径
const getBranchPath = (index, total) => {
  if (total <= 1) return ''
  const spacing = 80 / (total - 1)
  const x = 10 + index * spacing
  return `M50 10 Q ${x} 15 ${x} 20`
}

// 计算合并线路径
const getMergePath = (index, total) => {
  if (total <= 1) return ''
  const spacing = 80 / (total - 1)
  const x = 10 + index * spacing
  return `M${x} 0 Q ${x} 5 50 10`
}

// 获取阶段的父节点
const getParentNode = (stage) => {
  if (!stage.parallel || !stage.parentNode) return null

  // 计算进度
  const completedCount = stage.nodes.filter(n => n.status === 'DONE').length
  const totalCount = stage.nodes.length

  // 如果父节点没有设置状态，根据子节点计算
  const parentNode = { ...stage.parentNode }
  if (!parentNode.status || parentNode.status === 'PENDING') {
    const inProgressCount = stage.nodes.filter(n => n.status === 'IN_PROGRESS').length

    if (completedCount === stage.nodes.length) {
      parentNode.status = 'DONE'
    } else if (inProgressCount > 0 || completedCount > 0) {
      parentNode.status = 'IN_PROGRESS'
    } else {
      parentNode.status = 'PENDING'
    }
  }

  // 添加进度属性，供 WorkflowNode 显示
  parentNode.progress = {
    completed: completedCount,
    total: totalCount
  }

  return parentNode
}

// 检查父节点是否被选中
const isParentSelected = (stage) => {
  if (!stage.parentNode) return false
  return props.selectedNodeId === stage.parentNode.id
}

// 获取阶段进度文本
const getStageProgress = (stage) => {
  if (!stage.nodes || stage.nodes.length === 0) return '0/0'
  const completed = stage.nodes.filter(n => n.status === 'DONE').length
  return `${completed}/${stage.nodes.length}`
}

// 处理父节点点击
const handleParentSelect = (parentNode, stage) => {
  // 创建包含子节点信息的父节点对象
  const enhancedNode = {
    ...parentNode,
    childNodes: stage.nodes,
    isParent: true
  }
  emit('select-node', enhancedNode)
}

// Get node position for rollback arrow rendering
// Returns position relative to the timeline container
const getNodePosition = (nodeId) => {
  const cached = nodePositions.value[nodeId]
  if (cached) return cached

  // Find the node and its stage index
  let targetNode = null
  let stageIndex = 0
  let nodeIndexInStage = 0

  for (let i = 0; i < props.workflow?.stages?.length; i++) {
    const stage = props.workflow.stages[i]
    const idx = stage.nodes?.findIndex(n => n.id === nodeId)
    if (idx !== undefined && idx > -1) {
      targetNode = stage.nodes[idx]
      stageIndex = i
      nodeIndexInStage = idx
      break
    }
  }

  if (!targetNode) return { x: 0, y: 0 }

  // Calculate position
  // Each stage is approximately 160px wide (including gap)
  // Nodes within a stage are arranged vertically
  const stageWidth = 160
  const nodeHeight = 100
  const nodeGap = 10

  const x = stageIndex * stageWidth + 80 // Center of stage
  const y = nodeIndexInStage * (nodeHeight + nodeGap) + 50 // Center of node

  nodePositions.value[nodeId] = { x, y }
  return { x, y }
}

// Reset node positions cache when workflow changes
const resetNodePositions = () => {
  nodePositions.value = {}
}

// Set stage ref for DOM measurement
const setStageRef = (el, index) => {
  if (el) {
    stageRefs.value[index] = el
  }
}

// Measure stage positions using DOM
const measureStagePositions = () => {
  if (!scrollRef.value || !stageRefs.value) return

  const scrollRect = scrollRef.value.getBoundingClientRect()
  const positions = []

  // Use unified CENTER_Y based on first stage container center
  // All containers have min-height: 420px and justify-content: center
  // Node cards are 160px tall, centered in container, so center is at container top + 210px
  let unifiedCenterY = null

  // First pass: find the center Y from the first non-parallel stage (most reliable reference)
  for (let i = 0; i < sortedStages.value.length; i++) {
    const stageEl = stageRefs.value[i]
    if (stageEl && !sortedStages.value[i].parallel) {
      const rect = stageEl.getBoundingClientRect()
      const relativeY = rect.top - scrollRect.top
      unifiedCenterY = relativeY + rect.height / 2
      break
    }
  }

  // If no non-parallel stage found, use first stage or default
  if (unifiedCenterY === null) {
    if (stageRefs.value[0]) {
      const rect = stageRefs.value[0].getBoundingClientRect()
      unifiedCenterY = (rect.top - scrollRect.top) + 210 // 420px / 2
    } else {
      unifiedCenterY = 210 // Fallback for 420px container
    }
  }

  CENTER_Y = unifiedCenterY

  // Measure start node
  if (startNodeRef.value) {
    const rect = startNodeRef.value.getBoundingClientRect()
    startNodePos.value = {
      x: rect.left - scrollRect.left,
      y: rect.top - scrollRect.top,
      width: rect.width,
      height: rect.height,
      centerX: rect.left - scrollRect.left + rect.width / 2,
      centerY: CENTER_Y
    }
  }

  // Measure end node
  if (endNodeRef.value) {
    const rect = endNodeRef.value.getBoundingClientRect()
    endNodePos.value = {
      x: rect.left - scrollRect.left,
      y: rect.top - scrollRect.top,
      width: rect.width,
      height: rect.height,
      centerX: rect.left - scrollRect.left + rect.width / 2,
      centerY: CENTER_Y
    }
  }

  // Measure stages - use unified CENTER_Y for all
  sortedStages.value.forEach((stage, index) => {
    const stageEl = stageRefs.value[index]
    if (stageEl) {
      const rect = stageEl.getBoundingClientRect()
      const relativeY = rect.top - scrollRect.top

      positions.push({
        stageId: stage.id,
        x: rect.left - scrollRect.left,
        y: relativeY,
        width: rect.width,
        height: rect.height,
        centerX: rect.left - scrollRect.left + rect.width / 2,
        centerY: CENTER_Y // Use unified center Y for all stages
      })
    }
  })

  stagePositions.value = positions
}

// Get forward connector path between two points
// fromId/toId can be: 'start', 'end', or a stage ID
const getForwardPath = (fromId, toId) => {
  const from = getNodeEndpoint(fromId, 'output')
  const to = getNodeEndpoint(toId, 'input')

  // Simple straight line from right of 'from' to left of 'to'
  return `M ${from.x} ${from.y} L ${to.x} ${to.y}`
}

// Get the endpoint coordinates for a node/stage
// Returns {x, y} position relative to the timeline scroll container
// side: 'input' (left side) or 'output' (right side)
const getNodeEndpoint = (id, side = 'output') => {
  if (id === 'start') {
    // Start node: right edge of the start circle
    return { x: 36, y: CENTER_Y }
  }

  if (id === 'end') {
    // End node: left edge of the end circle
    const lastStagePos = stagePositions.value[stagePositions.value.length - 1]
    if (lastStagePos) {
      return { x: lastStagePos.x + lastStagePos.width + 40, y: lastStagePos.centerY }
    }
    return { x: 500, y: CENTER_Y }
  }

  // For stage IDs, find the stage position
  const stagePos = stagePositions.value.find(p => p.stageId === id)
  if (!stagePos) return { x: 0, y: 0 }

  // Return left or right edge based on side parameter
  // Use the stage's measured centerY for accurate alignment
  if (side === 'input') {
    return {
      x: stagePos.x,  // Left edge
      y: stagePos.centerY
    }
  } else {
    return {
      x: stagePos.x + stagePos.width,  // Right edge
      y: stagePos.centerY
    }
  }
}

// Dynamic center Y-axis - will be set from actual DOM measurement
let CENTER_Y = 100 // 统一的中心 Y 轴位置，初始值会在测量后更新

// Setup resize observer for responsive updates
const setupResizeObserver = () => {
  if (typeof window === 'undefined') return

  resizeObserver = new ResizeObserver(() => {
    nextTick(() => {
      measureStagePositions()
    })
  })

  if (scrollRef.value) {
    resizeObserver.observe(scrollRef.value)
  }
}

// Recalculate positions when workflow or stages change
workflowWatcher = watch(() => props.workflow, () => {
  resetNodePositions()
  nextTick(() => {
    measureStagePositions()
  })
}, { deep: true })

// Watch stage refs changes
stageRefsWatcher = watch(() => stageRefs.value.length, () => {
  nextTick(() => {
    measureStagePositions()
  })
})

// Measure positions on mount
onMounted(() => {
  nextTick(() => {
    measureStagePositions()
    setupResizeObserver()
  })
})

// Cleanup on before unmount - stop watchers to prevent callbacks during unmount
onBeforeUnmount(() => {
  if (workflowWatcher) {
    workflowWatcher()
  }
  if (stageRefsWatcher) {
    stageRefsWatcher()
  }
})

// Cleanup on unmount
onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
})
</script>

<style scoped>
.workflow-timeline {
  background: var(--bg-secondary, #f9fafb);
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  padding-top: 20px;
  margin-bottom: 8px;
  position: relative;
  box-sizing: border-box;
}

/* 折叠状态 */
.workflow-timeline.is-collapsed {
  padding-bottom: 12px;
}

.workflow-timeline.is-collapsed .workflow-header {
  margin-bottom: 0;
}

/* Workflow 标签 */
.workflow-label {
  position: absolute;
  top: -10px;
  left: 16px;
  background: #3b82f6;
  color: white;
  font-size: 11px;
  padding: 2px 10px;
  border-radius: 10px;
  font-weight: 500;
  letter-spacing: 0.5px;
}

/* 标题区 */
.workflow-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.workflow-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 折叠/展开按钮 */
.collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: #f3f4f6;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s ease;
}

.collapse-btn:hover {
  background: #e5e7eb;
  color: #3b82f6;
  transform: scale(1.05);
}

.collapse-btn .el-icon {
  font-size: 16px;
}

.workflow-title {
  display: flex;
  align-items: center;
  gap: 6px;
}

.workflow-icon {
  font-size: 16px;
}

.workflow-title h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #1f2937);
}

/* 进度条 */
.workflow-progress {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-bar {
  width: 100px;
  height: 6px;
  background: var(--bg-tertiary, #e5e7eb);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #10b981;
  border-radius: 3px;
  transition: width 0.5s ease;
}

.progress-text {
  font-size: 11px;
  color: var(--text-secondary, #6b7280);
  white-space: nowrap;
}

/* 时间线容器 */
.timeline-container {
  overflow-x: auto;
  margin-bottom: 8px;
  padding-top: 0; /* 移除 padding，避免 SVG 和 DOM 元素位置不一致 */
  max-width: 100%;
}

.timeline-scroll {
  min-width: max-content;
}

.timeline-stages {
  display: flex;
  align-items: center; /* 改为中心对齐，让所有阶段容器垂直居中 */
  gap: 40px; /* 阶段间距，用于放置箭头 */
}

/* 阶段容器 */
.stage-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center; /* 内容垂直居中 */
  position: relative;
  padding: 0 6px;
  min-height: 420px; /* 最小高度，确保并行阶段的内容有足够空间 (父节点 160 + 进度 20 + 标签 20 + 分支线 20 + 节点 160 + 分支线 20 + 间距) */
}

/* 原点阶段容器（开始/结束） */
.stage-container.origin-stage {
  min-width: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 420px; /* 与阶段容器相同的最小高度 */
}

/* 原点节点（开始/结束） */
.origin-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

/* 原点圆形 */
.origin-circle {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: bold;
  color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

/* 开始节点样式 */
.start-node .origin-circle {
  background: #10b981;
}

/* 结束节点样式 */
.end-node .origin-circle {
  background: #3b82f6;
}

/* 原点标签 */
.origin-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary, #6b7280);
}

.stage-container.is-parallel {
  background: rgba(59, 130, 246, 0.05);
  border-radius: 8px;
  padding: 6px 12px;
  border: 1px dashed rgba(59, 130, 246, 0.3);
  box-sizing: border-box;
}

/* 并行阶段的节点组使用 flex 布局，确保节点正确排列 */
.stage-nodes.parallel-nodes {
  display: flex;
  flex-direction: row;
  gap: 12px;
  align-items: center;
  justify-content: center;
  min-height: 140px;
}

/* 串行阶段的节点组放在容器中心 */
.stage-container:not(.is-parallel) .stage-nodes {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 140px;
}

/* 并行阶段的父节点包装器和标签放在顶部 */
.stage-container.is-parallel .parent-node-wrapper,
.stage-container.is-parallel .stage-label,
.stage-container.is-parallel .branch-lines {
  position: relative;
  z-index: 5;
}

/* 阶段标签 */
.stage-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 600;
  color: #3b82f6;
  margin-bottom: 6px;
  padding: 2px 6px;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 4px;
}

/* 父节点包装器 */
.parent-node-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;
}

.parent-progress {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
}

.parent-progress .progress-label {
  color: #6b7280;
}

.parent-progress .progress-value {
  font-weight: 600;
  color: #10b981;
}

.parallel-icon {
  font-size: 11px;
}

/* 分支线 */
.branch-lines {
  width: 100%;
  min-width: 150px;
}

.branch-lines svg {
  display: block;
}

/* 节点组 */
.stage-nodes {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: stretch;
  min-height: 140px; /* 确保至少有一个节点卡片的高度 (140px) */
}

/* 滚动条样式 */
.timeline-container::-webkit-scrollbar {
  height: 6px;
}

.timeline-container::-webkit-scrollbar-track {
  background: var(--bg-tertiary, #e5e7eb);
  border-radius: 3px;
}

.timeline-container::-webkit-scrollbar-thumb {
  background: var(--text-muted, #9ca3af);
  border-radius: 3px;
}

.timeline-container::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary, #6b7280);
}

/* 启动工作流按钮 */
.start-workflow-btn {
  margin-left: 10px;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background: #10b981;
  color: #fff;
  transition: all 0.2s ease;
}

.start-workflow-btn:hover {
  background: #059669;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4);
  transform: translateY(-1px);
}

/* 正向流程连接线 SVG 层 */
.forward-connectors {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  min-height: 300px;
  pointer-events: none;
  z-index: 5;
  overflow: visible;
  display: block;
}

.timeline-scroll {
  position: relative;
}
</style>
