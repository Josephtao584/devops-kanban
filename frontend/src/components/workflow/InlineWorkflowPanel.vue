<template>
  <div class="inline-workflow-panel" :class="{ compact }">
    <!-- Simplified node flow display -->
    <div class="nodes-flow" v-if="workflow?.stages">
      <template v-for="(stage, stageIndex) in sortedStages" :key="stage.id">
        <div class="stage-inline">
          <!-- Stage label -->
          <span class="stage-inline-label">{{ stage.name }}</span>

          <!-- Nodes in stage -->
          <div class="stage-nodes-inline">
            <template v-for="node in stage.nodes" :key="node.id">
              <button
                class="node-inline"
                :class="[
                  `status-${node.status?.toLowerCase()}`,
                  { 'is-current': node.id === currentNodeId && node.status === 'IN_PROGRESS', 'is-selected': node.id === currentNodeId, 'is-suspended': node.status === 'SUSPENDED' }
                ]"
                @click.stop="$emit('node-click', node)"
              >
                <span class="node-status-dot"></span>
                <span class="node-name-inline">{{ node.name }}</span>
                <!-- Suspend icon -->
                <span v-if="node.status === 'SUSPENDED'" class="node-suspend-icon" title="等待确认">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="6" y="4" width="4" height="16"></rect>
                    <rect x="14" y="4" width="4" height="16"></rect>
                  </svg>
                </span>
              </button>
            </template>
          </div>
        </div>

        <!-- Arrow between stages -->
        <span v-if="stageIndex < sortedStages.length - 1" class="stage-arrow">→</span>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  workflow: {
    type: Object,
    default: null
  },
  currentNodeId: {
    type: [String, Number],
    default: null
  },
  compact: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['node-click'])

const sortedStages = computed(() => {
  if (!props.workflow?.stages) return []
  return [...props.workflow.stages].sort((a, b) => a.order - b.order)
})
</script>

<style scoped>
.inline-workflow-panel {
  padding: 0;
}

.inline-workflow-panel.compact {
  /* Compact mode styles */
}

.nodes-flow {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
  overflow-x: auto;
  padding: 4px 0;
}

.stage-inline {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  flex-shrink: 0;
}

.stage-inline-label {
  font-size: 10px;
  color: #94a3b8;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
  padding-left: 2px;
}

.stage-nodes-inline {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 180px;
}

.stage-arrow {
  display: flex;
  align-items: center;
  align-self: center;
  color: #cbd5e1;
  font-size: 14px;
  font-weight: 300;
}

.node-inline {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 5px 10px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.node-inline:hover {
  border-color: #25C6C9;
  background: rgba(37, 198, 201, 0.06);
}

.node-inline.is-current {
  background: #fef3c7 !important;
  border-color: #f59e0b !important;
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.3);
  animation: pulse-current 2s ease-in-out infinite;
}

.node-inline.is-selected {
  background: rgba(37, 198, 201, 0.06);
  border-color: #25C6C9;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.3);
}

@keyframes pulse-current {
  0%, 100% { box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.3); }
  50% { box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.5); }
}

.node-inline.status-done {
  border-left: 3px solid #10b981;
}

.node-inline.status-in_progress {
  border-left: 3px solid #f59e0b;
}

.node-inline.status-failed,
.node-inline.status-rejected {
  border-left: 3px solid #ef4444;
}

.node-inline.status-pending {
  border-left: 3px solid #94a3b8;
}

.node-inline.status-suspended {
  border-left: 3px solid #f59e0b;
  background: #fef3c7;
}

.node-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-done .node-status-dot { background: #10b981; }
.status-in_progress .node-status-dot { background: #f59e0b; animation: blink 1.5s infinite; }
.status-failed .node-status-dot { background: #ef4444; }
.status-pending .node-status-dot { background: #94a3b8; }
.status-suspended .node-status-dot { background: #f59e0b; animation: blink 1.5s infinite; }

.node-name-inline {
  color: #334155;
  font-weight: 500;
  flex: 1;
}

.node-suspend-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #d97706;
  flex-shrink: 0;
}

.stage-arrow {
  color: #cbd5e1;
  font-size: 16px;
  font-weight: 300;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>
