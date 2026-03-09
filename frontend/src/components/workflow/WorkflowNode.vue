<template>
  <div
    class="workflow-node"
    :class="[
      `status-${node.status.toLowerCase()}`,
      { 'is-current': isCurrent, 'is-selected': isSelected, 'is-parent': isParentNode, 'is-rejected': isRejected }
    ]"
    @click="handleClick"
  >
    <!-- 状态图标 -->
    <div class="node-status-icon" :style="{ backgroundColor: statusColor }">
      <span v-if="node.status === 'DONE'">✓</span>
      <span v-else-if="node.status === 'IN_PROGRESS'" class="pulse">▶</span>
      <span v-else-if="node.status === 'FAILED'">✗</span>
      <span v-else-if="node.status === 'REJECTED'">↩</span>
      <span v-else>○</span>
    </div>

    <!-- 节点内容 -->
    <div class="node-content">
      <div class="node-name">{{ node.name }}</div>

      <!-- 角色和 Agent 并排显示 -->
      <div class="node-meta">
        <span class="node-role">{{ node.role }}</span>
        <span class="node-separator">•</span>
        <span class="node-agent" :style="{ color: agentColor }">
          <el-icon class="agent-icon"><component :is="agentIcon" /></el-icon>
          <span class="agent-name">{{ node.agentName }}</span>
        </span>
      </div>

      <!-- 父节点进度信息 -->
      <div v-if="isParentNode && node.progress" class="node-progress">
        <span class="progress-label">进度：{{ node.progress.completed }}/{{ node.progress.total }}</span>
      </div>

      <!-- 打回原因（rejected 状态显示） -->
      <div v-if="node.rejectedReason" class="node-rejected-reason">
        <el-icon class="reason-icon"><Warning /></el-icon>
        <span class="reason-text">{{ node.rejectedReason }}</span>
      </div>
    </div>

    <!-- 底部信息行：状态和耗时 -->
    <div class="node-footer">
      <span class="node-status-label" :style="{ color: statusColor }">{{ nodeStatusLabel }}</span>
      <span v-if="node.status === 'DONE' && node.duration" class="node-duration">{{ node.duration }}min</span>
    </div>

    <!-- 当前进行中标记 -->
    <div v-if="isCurrent" class="current-badge">
      <span class="pulse-dot"></span>
      当前
    </div>

    <!-- 父节点标记 -->
    <div v-if="isParentNode" class="parent-badge">
      <el-icon class="parent-icon"><Document /></el-icon>
      汇总
    </div>

    <!-- 打回标记 -->
    <div v-if="isRejected" class="rejected-badge">
      <el-icon><Back /></el-icon> 打回
    </div>

    <!-- 操作按钮 -->
    <div class="action-buttons">
      <!-- 查看详情按钮 -->
      <button
        class="action-btn view-btn"
        @click.stop="handleViewDetails"
        title="查看详情"
      >
        <el-icon><Document /></el-icon>
      </button>
      <!-- 运行中状态：暂停按钮 -->
      <button
        v-if="node.status === 'IN_PROGRESS'"
        class="action-btn pause-btn"
        @click.stop="handlePause"
        title="暂停任务"
      >
        <el-icon><VideoPause /></el-icon>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { agentConfig, nodeStatusConfig } from '@/mock/workflowData'
import {
  Back, Warning, Document, VideoPause,
  Monitor, VideoPlay, Edit, Cpu
} from '@element-plus/icons-vue'

// Icon mapping for agent types
const agentIconMap = {
  Monitor,
  VideoPlay,
  Edit,
  Cpu
}

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

// Compute if node is rejected
const isRejected = computed(() => {
  return props.node.status === 'REJECTED' || props.node.status === 'FAILED'
})

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
  const iconName = agentConfig[props.node.agentType]?.icon || 'Monitor'
  return agentIconMap[iconName] || Monitor
})

// Status label text
const nodeStatusLabel = computed(() => {
  const statusMap = {
    'DONE': '已完成',
    'IN_PROGRESS': '进行中',
    'PENDING': '待处理',
    'FAILED': '失败',
    'REJECTED': '已打回'
  }
  return statusMap[props.node.status] || props.node.status
})
</script>

<style scoped>
.workflow-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 14px;
  width: 160px;
  height: 130px;
  background: #fff;
  border-radius: 8px;
  border: 2px solid #e5e7eb;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  box-sizing: border-box;
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

/* Rejected/Failed node styles */
.workflow-node.is-rejected {
  border-color: #dc2626;
  background: #fef2f2;
  animation: shake 0.5s ease-in-out;
}

.workflow-node.is-rejected.status-rejected {
  border-color: #f59e0b;
  background: #fffbeb;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

/* Parent node styles */
.workflow-node.is-parent {
  width: 180px;
  height: 130px;
  padding: 10px 14px;
  border-width: 2px;
  background: #fffbeb;
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
  background: #f0fdf4;
}

.workflow-node.is-parent.status-in_progress {
  border-color: #3b82f6;
  background: #eff6ff;
}

/* 状态样式 */
.workflow-node.status-done {
  border-color: #10b981;
  background: #f0fdf4;
}

.workflow-node.status-in_progress {
  border-color: #3b82f6;
  background: #eff6ff;
}

.workflow-node.status-pending {
  opacity: 0.7;
  border-color: #d1d5db;
}

.workflow-node.status-failed {
  border-color: #dc2626;
  background: #fef2f2;
}

.workflow-node.status-rejected {
  border-color: #f59e0b;
  background: #fffbeb;
}

/* 状态图标 */
.node-status-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 11px;
  font-weight: bold;
  flex-shrink: 0;
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
  width: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
  min-height: 0;
}

.node-name {
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 4px;
  line-height: 1.3;
  overflow: visible;
  white-space: normal;
  width: 100%;
  flex-shrink: 0;
}

/* 角色和 Agent 并排显示 */
.node-meta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-bottom: 2px;
  font-size: 11px;
  flex-wrap: wrap;
}

.node-role {
  color: #6b7280;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 80px;
}

.node-separator {
  color: #d1d5db;
  flex-shrink: 0;
}

.node-agent {
  display: flex;
  align-items: center;
  gap: 2px;
  font-weight: 500;
  overflow: visible;
  white-space: nowrap;
}

.agent-icon {
  font-size: 12px;
  flex-shrink: 0;
}

.node-progress {
  font-size: 10px;
  color: #6b7280;
  margin-top: 2px;
  padding: 2px 6px;
  background: #f3f4f6;
  border-radius: 4px;
  flex-shrink: 0;
}

/* 打回原因样式 */
.node-rejected-reason {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 9px;
  color: #dc2626;
  margin-top: 2px;
  padding: 2px 6px;
  background: #fef2f2;
  border-radius: 4px;
  border: 1px solid #fecaca;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  flex-shrink: 0;
}

.reason-icon {
  font-size: 12px;
  flex-shrink: 0;
}

.reason-text {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 底部信息行：状态和耗时 */
.node-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding-top: 6px;
  margin-top: auto;
  border-top: 1px solid #f3f4f6;
}

.node-status-label {
  font-size: 10px;
  font-weight: 500;
}

.node-duration {
  font-size: 10px;
  color: #10b981;
  font-weight: 500;
}

/* 当前标记 */
.current-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 6px;
  background: #3b82f6;
  color: #fff;
  font-size: 9px;
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
  padding: 2px 6px;
  background: #f59e0b;
  color: #fff;
  font-size: 9px;
  font-weight: 500;
  border-radius: 6px;
}

.parent-icon {
  font-size: 12px;
}

/* 打回标记 */
.rejected-badge {
  position: absolute;
  top: -5px;
  left: -5px;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 6px;
  background: #dc2626;
  color: #fff;
  font-size: 9px;
  font-weight: 500;
  border-radius: 7px;
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
  display: flex;
  justify-content: center;
  gap: 6px;
  padding-top: 6px;
  width: 100%;
}

.action-btn {
  padding: 3px 8px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn:hover {
  transform: scale(1.05);
}

.start-btn {
  background: #10b981;
  color: #fff;
}

.start-btn:hover {
  background: #059669;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4);
}

.view-btn {
  background: #3b82f6;
  color: #fff;
}

.view-btn:hover {
  background: #2563eb;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
}

.pause-btn {
  background: #f59e0b;
  color: #fff;
}

.pause-btn:hover {
  background: #d97706;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);
}
</style>
