<template>
  <div class="workflow-timeline">
    <!-- 工作流标题区 -->
    <div class="workflow-header">
      <div class="workflow-title">
        <span class="workflow-icon">🔄</span>
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
      <div class="workflow-progress">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progress.percent + '%' }"></div>
        </div>
        <span class="progress-text">{{ progress.completed }}/{{ progress.total }} 完成</span>
      </div>
    </div>

    <!-- 节点时间线 - 按阶段展示 -->
    <div class="timeline-container">
      <div class="timeline-scroll">
        <div class="timeline-stages">
          <template v-for="(stage, stageIndex) in sortedStages" :key="stage.id">
            <!-- 阶段容器 -->
            <div class="stage-container" :class="{ 'is-parallel': stage.parallel }">
              <!-- 父节点卡片 - 仅并行阶段显示 -->
              <div v-if="stage.parallel && getParentNode(stage)" class="parent-node-wrapper">
                <WorkflowNode
                  :node="getParentNode(stage)"
                  :is-current="false"
                  :is-selected="isParentSelected(stage)"
                  :is-parent-node="true"
                  @select="handleParentSelect($event, stage)"
                  @pause="$emit('pause-task', $event)"
                  @view-details="$emit('view-details', $event)"
                />
                <div class="parent-progress">
                  <span class="progress-label">进度:</span>
                  <span class="progress-value">{{ getStageProgress(stage) }}</span>
                </div>
              </div>

              <!-- 阶段标签 -->
              <div class="stage-label" v-if="stage.parallel">
                <span class="parallel-icon">⚡</span>
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
                    :is-current="node.id === workflow?.currentNodeId"
                    :is-selected="node.id === selectedNodeId"
                    @select="$emit('select-node', $event)"
                    @pause="$emit('pause-task', $event)"
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
                  <path d="M50 10 L50 20" stroke="#3b82f6" stroke-width="2" fill="none"/>
                </svg>
              </div>

              <!-- 阶段间连接线 -->
              <div v-if="stageIndex < sortedStages.length - 1" class="stage-connector">
                <div class="connector-arrow">→</div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { computed } from 'vue'
import WorkflowNode from './WorkflowNode.vue'
import { nodeStatusConfig, getWorkflowProgress, getAllNodes } from '@/mock/workflowData'

const props = defineProps({
  workflow: {
    type: Object,
    default: null
  },
  selectedNodeId: {
    type: [Number, String],
    default: null
  }
})

const emit = defineEmits(['select-node', 'start-workflow', 'pause-task', 'view-details'])

const sortedStages = computed(() => {
  if (!props.workflow?.stages) return []
  return [...props.workflow.stages].sort((a, b) => a.order - b.order)
})

const progress = computed(() => {
  return getWorkflowProgress(props.workflow)
})

// 判断工作流是否处于待运行状态（所有节点都是 PENDING 或 TODO）
const isWorkflowPending = computed(() => {
  if (!props.workflow?.stages) return false
  const allNodes = getAllNodes(props.workflow)
  if (allNodes.length === 0) return false
  return allNodes.every(node => node.status === 'PENDING' || node.status === 'TODO')
})

// 启动工作流
const handleStartWorkflow = () => {
  emit('start-workflow', props.workflow)
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

  // 如果父节点没有设置状态，根据子节点计算
  const parentNode = { ...stage.parentNode }
  if (!parentNode.status || parentNode.status === 'PENDING') {
    const completedCount = stage.nodes.filter(n => n.status === 'DONE').length
    const inProgressCount = stage.nodes.filter(n => n.status === 'IN_PROGRESS').length

    if (completedCount === stage.nodes.length) {
      parentNode.status = 'DONE'
    } else if (inProgressCount > 0 || completedCount > 0) {
      parentNode.status = 'IN_PROGRESS'
    } else {
      parentNode.status = 'PENDING'
    }
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
</script>

<style scoped>
.workflow-timeline {
  background: var(--bg-secondary, #f9fafb);
  border-radius: 8px;
  padding: 10px 16px;
  margin-bottom: 8px;
}

/* 标题区 */
.workflow-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
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
  background: linear-gradient(to right, #10b981, #34d399);
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
  padding-top: 10px;
}

.timeline-scroll {
  min-width: max-content;
}

.timeline-stages {
  display: flex;
  align-items: flex-start;
  gap: 0;
}

/* 阶段容器 */
.stage-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  padding: 0 6px;
}

.stage-container.is-parallel {
  background: linear-gradient(to bottom, rgba(59, 130, 246, 0.05), transparent);
  border-radius: 8px;
  padding: 6px 12px;
  border: 1px dashed rgba(59, 130, 246, 0.3);
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
  align-items: center;
}

.stage-nodes.parallel-nodes {
  flex-direction: row;
  gap: 12px;
}

/* 阶段连接器 */
.stage-connector {
  display: flex;
  align-items: center;
  padding: 0 6px;
  align-self: center;
}

.connector-arrow {
  font-size: 16px;
  color: var(--text-muted, #9ca3af);
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
  background: linear-gradient(135deg, #10b981, #059669);
  color: #fff;
  transition: all 0.2s ease;
}

.start-workflow-btn:hover {
  background: linear-gradient(135deg, #059669, #047857);
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4);
  transform: translateY(-1px);
}
</style>
