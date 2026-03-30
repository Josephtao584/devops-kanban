<template>
  <div v-if="plan.hasPlan" class="plan-summary">
    <button class="plan-toggle" @click="isExpanded = !isExpanded">
      <span class="plan-toggle-icon">{{ isExpanded ? '▼' : '▶' }}</span>
      <span class="plan-toggle-text">{{ isExpanded ? '收起计划' : '查看计划' }}</span>
      <span v-if="currentStepTitle" class="current-step-hint">{{ currentStepTitle }}</span>
    </button>

    <div v-if="isExpanded" class="plan-content">
      <div class="plan-steps">
        <div
          v-for="step in plan.steps"
          :key="step.id"
          class="plan-step"
          :class="`plan-step--${step.status}`"
        >
          <div class="step-header">
            <span class="step-status-icon">{{ statusIcon(step.status) }}</span>
            <span class="step-number">{{ step.id }}.</span>
            <span class="step-title">{{ step.title || '步骤 ' + step.id }}</span>
          </div>
          <div v-if="step.substeps.length > 0" class="step-substeps">
            <div
              v-for="substep in step.substeps"
              :key="substep.id"
              class="substep"
              :class="`substep--${substep.status}`"
            >
              <span class="substep-status-icon">{{ substepStatusIcon(substep.status) }}</span>
              <span class="substep-number">{{ step.id }}-{{ substep.id }}.</span>
              <span class="substep-title">{{ substep.title || '子步骤' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="plan-empty">
    <span class="plan-empty-text">暂无计划</span>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  plan: {
    type: Object,
    default: () => ({
      steps: [],
      hasPlan: false,
      currentStep: null
    })
  }
})

const isExpanded = ref(false)

const currentStepTitle = computed(() => {
  const current = props.plan.steps.find((s) => s.status === 'running')
  return current?.title || ''
})

function statusIcon(status) {
  switch (status) {
    case 'completed':
      return '✅'
    case 'running':
      return '🔄'
    default:
      return '⏳'
  }
}

function substepStatusIcon(status) {
  switch (status) {
    case 'completed':
      return '✅'
    case 'running':
      return '🔄'
    default:
      return '○'
  }
}
</script>

<style scoped>
.plan-summary {
  flex-shrink: 0;
  margin-bottom: 8px;
}

.plan-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e0e7ff;
  border-radius: 10px;
  background: linear-gradient(135deg, #eef2ff 0%, #f5f7ff 100%);
  cursor: pointer;
  font-size: 13px;
  color: #4338ca;
  font-weight: 500;
  transition: all 0.15s ease;
}

.plan-toggle:hover {
  background: linear-gradient(135deg, #e0e7ff 0%, #e8edff 100%);
  border-color: #c7d2fe;
}

.plan-toggle-icon {
  font-size: 10px;
  color: #6366f1;
}

.plan-toggle-text {
  flex-shrink: 0;
}

.current-step-hint {
  margin-left: auto;
  font-size: 12px;
  color: #818cf8;
  font-weight: 400;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

.plan-content {
  margin-top: 8px;
  padding: 12px;
  border: 1px solid #e0e7ff;
  border-radius: 10px;
  background: #ffffff;
}

.plan-steps {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.plan-step {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.plan-step--completed {
  opacity: 0.75;
}

.plan-step--running .step-header {
  color: #4338ca;
  font-weight: 600;
}

.step-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #374151;
}

.step-status-icon {
  font-size: 12px;
  flex-shrink: 0;
}

.step-number {
  font-weight: 600;
  flex-shrink: 0;
}

.step-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.step-substeps {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-left: 24px;
  padding-left: 10px;
  border-left: 2px solid #e0e7ff;
}

.substep {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
}

.substep--completed {
  color: #9ca3af;
}

.substep--running {
  color: #6366f1;
  font-weight: 500;
}

.substep-status-icon {
  font-size: 10px;
  flex-shrink: 0;
}

.substep-number {
  font-weight: 500;
  flex-shrink: 0;
}

.substep-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plan-empty {
  padding: 6px 12px;
  font-size: 12px;
  color: #9ca3af;
}

.plan-empty-text {
  font-style: italic;
}
</style>
