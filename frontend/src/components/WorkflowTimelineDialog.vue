<template>
  <el-dialog
    v-model="visible"
    :title="$t('workflow.title')"
    width="80%"
    class="workflow-dialog"
    @close="handleClose"
  >
    <WorkflowTimeline
      v-if="workflow"
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
import { getWorkflowByTask } from '../mock/workflowData'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  taskId: {
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

// Fetch workflow data when dialog opens
watch(() => props.modelValue, (isOpen) => {
  if (isOpen && props.taskId) {
    workflow.value = getWorkflowByTask(props.taskId)
    selectedNodeId.value = null
  }
})

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
