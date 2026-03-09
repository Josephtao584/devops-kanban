<template>
  <div
    class="workflow-node"
    :class="[
      `status-${node.status.toLowerCase()}`,
      { 'is-current': isCurrent, 'is-selected': isSelected, 'is-parent': isParentNode }
    ]"
    @click="handleClick"
  >
    <!-- 状态图标 -->
    <div class="node-status-icon" :style="{ backgroundColor: statusColor }">
      <span v-if="node.status === 'DONE'">✓</span>
      <span v-else-if="node.status === 'IN_PROGRESS'" class="pulse">▶</span>
      <span v-else>○</span>
    </div>

    <!-- 节点内容 -->
    <div class="node-content">
      <div class="node-name">{{ node.name }}</div>
      <div class="node-role">{{ node.role }}</div>

      <!-- Agent 信息 -->
      <div class="node-agent" :style="{ color: agentColor }">
        <span class="agent-icon">{{ agentIcon }}</span>
        <span class="agent-name">{{ node.agentName }}</span>
      </div>

      <!-- 父节点进度信息 -->
      <div v-if="isParentNode && node.progress" class="node-progress">
        <span class="progress-label">进度: {{ node.progress.completed }}/{{ node.progress.total }}</span>
      </div>

      <!-- 耗时（已完成节点显示） -->
      <div v-if="node.status === 'DONE' && node.duration" class="node-duration">
        {{ node.duration }}min
      </div>
    </div>

    <!-- 当前进行中标记 -->
    <div v-if="isCurrent" class="current-badge">
      <span class="pulse-dot"></span>
      当前
    </div>

    <!-- 父节点标记 -->
    <div v-if="isParentNode" class="parent-badge">
      <span class="parent-icon">📋</span>
      汇总
    </div>

    <!-- 操作按钮 -->
    <div class="action-buttons">
      <!-- 查看详情按钮 -->
      <button
        class="action-btn view-btn"
        @click.stop="handleViewDetails"
        title="查看详情"
      >
        📋 详情
      </button>
      <!-- 运行中状态：暂停按钮 -->
      <button
        v-if="node.status === 'IN_PROGRESS'"
        class="action-btn pause-btn"
        @click.stop="handlePause"
        title="暂停任务"
      >
        ⏸ 暂停
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { agentConfig, nodeStatusConfig } from '@/mock/workflowData'

const props = defineProps({
  node: {
    type: Object,
    required: true
  },
  isCurrent: {
    type: Boolean,
    default: false
  },
  isSelected: {
    type: Boolean,
    default: false
  },
  isParentNode: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['select', 'pause', 'view-details'])

// Handle click event
const handleClick = () => {
  emit('select', props.node)
}

// Handle pause button click
const handlePause = () => {
  emit('pause', props.node)
}

// Handle view details button click
const handleViewDetails = () => {
  emit('view-details', props.node)
}

const statusColor = computed(() => {
  return nodeStatusConfig[props.node.status]?.color || '#6B7280'
})

const agentColor = computed(() => {
  return agentConfig[props.node.agentType]?.color || '#6B7280'
})

const agentIcon = computed(() => {
  return agentConfig[props.node.agentType]?.icon || '🤖'
})
</script>

<style scoped>
.workflow-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 14px;
  min-width: 110px;
  background: #fff;
  border-radius: 8px;
  border: 2px solid #e5e7eb;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}

.workflow-node:hover {
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
  transform: translateY(-2px);
}

.workflow-node.is-selected {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

/* Parent node styles */
.workflow-node.is-parent {
  min-width: 140px;
  padding: 10px 14px;
  border-width: 2px;
  background: linear-gradient(to bottom, #fffbeb, #fff);
  border-color: #f59e0b;
}

.workflow-node.is-parent:hover {
  border-color: #d97706;
  box-shadow: 0 6px 20px rgba(245, 158, 11, 0.25);
}

.workflow-node.is-parent.is-selected {
  border-color: #f59e0b;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.3);
}

.workflow-node.is-parent.status-done {
  border-color: #10b981;
  background: linear-gradient(to bottom, #f0fdf4, #fff);
}

.workflow-node.is-parent.status-in_progress {
  border-color: #3b82f6;
  background: linear-gradient(to bottom, #eff6ff, #fff);
}

/* 状态样式 */
.workflow-node.status-done {
  border-color: #10b981;
  background: linear-gradient(to bottom, #f0fdf4, #fff);
}

.workflow-node.status-in_progress {
  border-color: #3b82f6;
  background: linear-gradient(to bottom, #eff6ff, #fff);
}

.workflow-node.status-pending {
  opacity: 0.7;
  border-color: #d1d5db;
}

/* 状态图标 */
.node-status-icon {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 10px;
  font-weight: bold;
  margin-bottom: 3px;
}

.node-status-icon .pulse {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* 节点内容 */
.node-content {
  text-align: center;
}

.node-name {
  font-size: 10px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 2px;
  line-height: 1.2;
}

.node-role {
  font-size: 9px;
  color: #6b7280;
  margin-bottom: 2px;
}

.node-agent {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 9px;
  font-weight: 500;
}

.agent-icon {
  font-size: 10px;
}

.node-duration {
  font-size: 8px;
  color: #10b981;
  margin-top: 3px;
  padding: 1px 3px;
  background: #d1fae5;
  border-radius: 3px;
}

/* 当前标记 */
.current-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 1px 5px;
  background: #3b82f6;
  color: #fff;
  font-size: 8px;
  font-weight: 500;
  border-radius: 7px;
}

.parent-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 1px 5px;
  background: #f59e0b;
  color: #fff;
  font-size: 8px;
  font-weight: 500;
  border-radius: 6px;
}

.parent-icon {
  font-size: 9px;
}

.pulse-dot {
  width: 4px;
  height: 4px;
  background: #fff;
  border-radius: 50%;
  animation: pulse-dot 1.5s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.5); opacity: 0.5; }
}

/* 操作按钮 */
.action-buttons {
  margin-top: 6px;
  display: flex;
  justify-content: center;
  gap: 4px;
}

.action-btn {
  padding: 3px 8px;
  font-size: 9px;
  font-weight: 500;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.action-btn:hover {
  transform: scale(1.05);
}

.start-btn {
  background: linear-gradient(135deg, #10b981, #059669);
  color: #fff;
}

.start-btn:hover {
  background: linear-gradient(135deg, #059669, #047857);
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4);
}

.view-btn {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #fff;
}

.view-btn:hover {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
}

.pause-btn {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: #fff;
}

.pause-btn:hover {
  background: linear-gradient(135deg, #d97706, #b45309);
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);
}
</style>
