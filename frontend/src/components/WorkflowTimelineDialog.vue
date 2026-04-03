<template>
  <el-dialog
    v-model="visible"
    :close-on-click-modal="false"
    :title="$t('workflow.title')"
    width="80%"
    class="workflow-dialog"
    @close="handleClose"
  >
    <div v-if="loading" class="empty-workflow">
      <p>加载中...</p>
    </div>
    <div v-else-if="error" class="empty-workflow">
      <p>{{ error }}</p>
    </div>
    <WorkflowTimeline
      v-else-if="workflow"
      :workflow="workflow"
      :selected-node-id="selectedNodeId"
      :default-collapsed="false"
      @select-node="handleSelectNode"
      @view-details="handleViewDetails"
      @start-workflow="handleStartWorkflow"
    />
    <div v-else class="empty-workflow">
      <p>{{ $t('workflow.noWorkflow') }}</p>
    </div>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import WorkflowTimeline from './workflow/WorkflowTimeline.vue'
import { getWorkflowRun } from '../api/workflow.js'
import { toTimelineWorkflow } from '../utils/workflowRunViewModel'

const loading = ref(false)
const error = ref(null)

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  taskId: {
    type: [Number, String],
    default: null
  },
  workflowRunId: {
    type: [Number, String],
    default: null
  }
})

const emit = defineEmits(['update:modelValue', 'select-node', 'view-details', 'start-workflow'])

const { t } = useI18n()

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const workflow = ref(null)
const selectedNodeId = ref(null)

async function loadWorkflow() {
  workflow.value = null
  error.value = null
  if (!props.workflowRunId) {
    return
  }
  loading.value = true
  try {
    const response = await getWorkflowRun(props.workflowRunId)
    if (response.success) {
      workflow.value = toTimelineWorkflow(response.data)
    } else {
      error.value = response.message || '加载工作流失败'
    }
  } catch (err) {
    error.value = err.message || '加载工作流失败'
  } finally {
    loading.value = false
  }
}

watch(() => [props.modelValue, props.workflowRunId], async ([isOpen]) => {
  if (isOpen) {
    selectedNodeId.value = null
    await loadWorkflow()
  }
}, { immediate: true })

const handleClose = () => {
  emit('update:modelValue', false)
}

const handleSelectNode = (node) => {
  selectedNodeId.value = node.id
  emit('select-node', node)
}

const handleViewDetails = (node) => {
  emit('view-details', node)
}

const handleStartWorkflow = (wf) => {
  emit('start-workflow', wf)
}
</script>

<style scoped>
.workflow-dialog {
  max-height: 80vh;
}

.workflow-dialog :deep(.el-dialog__body) {
  padding: 16px 20px;
}

.empty-workflow {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--text-muted, #94a3b8);
}

.empty-workflow p {
  font-size: 14px;
}
</style>
