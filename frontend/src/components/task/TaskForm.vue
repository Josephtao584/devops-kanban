<template>
  <el-form
    ref="formRef"
    :model="formData"
    :rules="rules"
    label-width="80px"
    @submit.prevent="handleSubmit"
  >
    <el-form-item :label="$t('task.title')" prop="title">
      <el-input v-model="formData.title" :placeholder="$t('task.titlePlaceholder')" />
    </el-form-item>

    <el-form-item :label="$t('task.description')" prop="description">
      <el-input
        v-model="formData.description"
        type="textarea"
        :rows="3"
        :placeholder="$t('task.descriptionPlaceholder')"
      />
    </el-form-item>

    <el-form-item :label="$t('task.category')" prop="category">
      <el-select v-model="formData.category" style="width: 100%" clearable>
        <el-option
          v-for="category in categoryOptions"
          :key="category.value"
          :label="category.label"
          :value="category.value"
        />
      </el-select>
      <div class="form-item-hint">{{ $t('task.categoryHint') }}</div>
    </el-form-item>

    <el-form-item :label="$t('task.status')" prop="status">
      <el-select v-model="formData.status" style="width: 100%">
        <el-option
          v-for="status in statusOptions"
          :key="status.value"
          :label="status.label"
          :value="status.value"
        />
      </el-select>
    </el-form-item>

    <el-form-item :label="$t('task.priority')" prop="priority">
      <el-select v-model="formData.priority" style="width: 100%">
        <el-option
          v-for="priority in priorityOptions"
          :key="priority.value"
          :label="priority.label"
          :value="priority.value"
        />
      </el-select>
    </el-form-item>

    <el-form-item :label="$t('task.assignee')" prop="assignee">
      <el-input v-model="formData.assignee" :placeholder="$t('task.assigneePlaceholder')" />
    </el-form-item>

    <el-form-item :label="$t('task.iteration')" prop="iteration_id">
      <IterationSelect
        v-model="formData.iteration_id"
        :iterations="iterations"
        :placeholder="$t('task.selectIteration')"
      />
      <div class="form-item-hint">{{ $t('task.iterationHint') }}</div>
    </el-form-item>

    <el-form-item :label="$t('task.autoTransitionLabel')">
      <el-switch
        v-model="formData.autoTransitionEnabled"
        :active-text="$t('common.enabled')"
        :inactive-text="$t('common.disabled')"
      />
      <div class="form-item-hint">{{ $t('task.autoTransitionHint') }}</div>
    </el-form-item>

    <el-form-item :label="$t('task.autoAssignWorkflowLabel')">
      <el-switch
        v-model="formData.autoAssignWorkflow"
        :active-text="$t('common.enabled')"
        :inactive-text="$t('common.disabled')"
      />
      <div class="form-item-hint">{{ $t('task.autoAssignWorkflowHint') }}</div>
    </el-form-item>

    <el-form-item>
      <el-button type="primary" @click="handleSubmit" :disabled="loading">
        {{ loading ? (isNew ? $t('task.creating', '创建中...') : $t('common.saving', '保存中...')) : (isNew ? $t('task.create') : $t('task.save')) }}
      </el-button>
      <el-button @click="$emit('cancel')">{{ $t('common.cancel') }}</el-button>
    </el-form-item>
  </el-form>
</template>

<script setup>
import { ref, reactive, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { TASK_STATUS, TASK_PRIORITY } from '../../constants/task'
import { TaskCategory, getCategoryOptions, analyzeTaskCategory } from '../../mock/workflowAssignment'
import IterationSelect from '../iteration/IterationSelect.vue'

const props = defineProps({
  task: {
    type: Object,
    default: null
  },
  iterations: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['submit', 'cancel'])

const { t, locale } = useI18n()
const formRef = ref(null)

const isNew = computed(() => !props.task?.id)

const formData = reactive({
  title: '',
  description: '',
  category: '',  // Empty means auto-detect
  status: TASK_STATUS.TODO,
  priority: TASK_PRIORITY.MEDIUM,
  assignee: '',
  iteration_id: null,
  autoTransitionEnabled: false,
  autoAssignWorkflow: true  // Default to true for new tasks
})

const rules = {
  title: [
    { required: true, message: t('validation.titleRequired', 'Title is required'), trigger: 'blur' }
  ]
}

const statusOptions = computed(() => [
  { value: TASK_STATUS.TODO, label: t('status.TODO', '待处理') },
  { value: TASK_STATUS.IN_PROGRESS, label: t('status.IN_PROGRESS', '处理中') },
  { value: TASK_STATUS.DONE, label: t('status.DONE', '已完成') },
  { value: TASK_STATUS.BLOCKED, label: t('status.BLOCKED', '挂起') }
])

const priorityOptions = computed(() => [
  { value: TASK_PRIORITY.CRITICAL, label: t('task.priority.critical', 'Critical') },
  { value: TASK_PRIORITY.HIGH, label: t('task.priority.high', 'High') },
  { value: TASK_PRIORITY.MEDIUM, label: t('task.priority.medium', 'Medium') },
  { value: TASK_PRIORITY.LOW, label: t('task.priority.low', 'Low') }
])

const categoryOptions = computed(() => {
  const lang = locale.value === 'zh' ? 'zh' : 'en'
  return getCategoryOptions(lang)
})

// Watch for task changes to populate form
watch(() => props.task, (newTask) => {
  if (newTask) {
    formData.title = newTask.title || ''
    formData.description = newTask.description || ''
    formData.category = newTask.category || ''
    formData.status = newTask.status || TASK_STATUS.TODO
    formData.priority = newTask.priority || TASK_PRIORITY.MEDIUM
    formData.assignee = newTask.assignee || ''
    formData.iteration_id = newTask.iteration_id || null
    formData.autoTransitionEnabled = newTask.autoTransitionEnabled === true
    formData.autoAssignWorkflow = newTask.autoAssignWorkflow !== false
  }
}, { immediate: true })

const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()

    // Auto-detect category if not set
    let category = formData.category
    if (!category && formData.title) {
      category = analyzeTaskCategory(formData.title, formData.description)
    }

    emit('submit', {
      ...formData,
      category: category || TaskCategory.FEATURE
    })
  } catch {
    // Validation failed
  }
}

// Expose methods
defineExpose({
  validate: () => formRef.value?.validate(),
  resetFields: () => formRef.value?.resetFields()
})
</script>

<style scoped>
.form-item-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
  line-height: 1.4;
}
</style>
