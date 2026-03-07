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

    <el-form-item :label="$t('task.autoTransitionLabel')">
      <el-switch
        v-model="formData.autoTransitionEnabled"
        :active-text="$t('common.enabled')"
        :inactive-text="$t('common.disabled')"
      />
      <div class="form-item-hint">{{ $t('task.autoTransitionHint') }}</div>
    </el-form-item>

    <el-form-item>
      <el-button type="primary" @click="handleSubmit" :loading="loading">
        {{ isNew ? $t('task.create') : $t('task.save') }}
      </el-button>
      <el-button @click="$emit('cancel')">{{ $t('common.cancel') }}</el-button>
    </el-form-item>
  </el-form>
</template>

<script setup>
import { ref, reactive, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { TASK_STATUS, TASK_PRIORITY } from '../../constants/task'

const props = defineProps({
  task: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['submit', 'cancel'])

const { t } = useI18n()
const formRef = ref(null)

const isNew = computed(() => !props.task?.id)

const formData = reactive({
  title: '',
  description: '',
  status: TASK_STATUS.TODO,
  priority: TASK_PRIORITY.MEDIUM,
  assignee: '',
  autoTransitionEnabled: true
})

const rules = {
  title: [
    { required: true, message: t('validation.titleRequired', 'Title is required'), trigger: 'blur' }
  ]
}

const statusOptions = computed(() => [
  { value: TASK_STATUS.TODO, label: t('task.status.TODO', 'To Do') },
  { value: TASK_STATUS.DESIGN, label: t('task.status.DESIGN', 'Design') },
  { value: TASK_STATUS.DEVELOPMENT, label: t('task.status.DEVELOPMENT', 'Development') },
  { value: TASK_STATUS.TESTING, label: t('task.status.TESTING', 'Testing') },
  { value: TASK_STATUS.RELEASE, label: t('task.status.RELEASE', 'Release') },
  { value: TASK_STATUS.DONE, label: t('task.status.DONE', 'Done') }
])

const priorityOptions = computed(() => [
  { value: TASK_PRIORITY.CRITICAL, label: t('task.priority.critical', 'Critical') },
  { value: TASK_PRIORITY.HIGH, label: t('task.priority.high', 'High') },
  { value: TASK_PRIORITY.MEDIUM, label: t('task.priority.medium', 'Medium') },
  { value: TASK_PRIORITY.LOW, label: t('task.priority.low', 'Low') }
])

// Watch for task changes to populate form
watch(() => props.task, (newTask) => {
  if (newTask) {
    formData.title = newTask.title || ''
    formData.description = newTask.description || ''
    formData.status = newTask.status || TASK_STATUS.TODO
    formData.priority = newTask.priority || TASK_PRIORITY.MEDIUM
    formData.assignee = newTask.assignee || ''
    formData.autoTransitionEnabled = newTask.autoTransitionEnabled !== false
  }
}, { immediate: true })

const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
    emit('submit', { ...formData })
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
