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

      <!-- 角色显示 -->
      <div class="node-meta">
        <span class="node-role">{{ node.role }}</span>
      </div>

      <!-- 父节点进度信息 -->
      <div v-if="isParentNode && node.progress" class="node-progress">
        <span class="progress-label">进度：{{ node.progress.completed }}/{{ node.progress.total }}</span>
      </div>
    </div>

    <!-- 底部信息行：只展示耗时 -->
    <div class="node-footer">
      <span v-if="node.duration" class="node-duration">
        <el-icon><Timer /></el-icon>
        {{ node.duration }} min
      </span>
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
import { nodeStatusConfig } from '@/mock/workflowData'
import {
  Back, Warning, Document, VideoPause, Timer
} from '@element-plus/icons-vue'

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
</script>

<style scoped>
.workflow-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 16px;
  width: 200px;
  min-height: 140px;
  height: auto;
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

.workflow-node.is-current {
  border-color: #f59e0b !important;
  background: #fef3c7 !important;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.3);
  animation: pulse-node 2s ease-in-out infinite;
}

@keyframes pulse-node {
  0%, 100% { box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.3); }
  50% { box-shadow: 0 0 0 5px rgba(245, 158, 11, 0.5); }
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
  width: 220px;
  min-height: 140px;
  height: auto;
  padding: 12px 16px;
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
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 12px;
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
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
  gap: 4px;
}

.node-name {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.3;
  overflow: visible;
  white-space: normal;
  width: 100%;
  flex-shrink: 0;
}

/* 角色显示 */
.node-meta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  flex-wrap: wrap;
}

.node-role {
  color: #6b7280;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100px;
}

.node-progress {
  font-size: 11px;
  color: #6b7280;
  padding: 3px 8px;
  background: #f3f4f6;
  border-radius: 4px;
  flex-shrink: 0;
}

/* 底部信息行：只展示耗时 */
.node-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding-top: 6px;
  border-top: 1px solid #f3f4f6;
}

.node-duration {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
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
  gap: 8px;
  padding-top: 8px;
  width: 100%;
}

.action-btn {
  padding: 4px 10px;
  font-size: 13px;
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
