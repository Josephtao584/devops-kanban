<template>
  <el-dialog
    v-model="visible"
    :title="isEditing ? $t('iteration.editIteration') : $t('iteration.createIteration')"
    width="600px"
    :close-on-click-modal="false"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
    >
      <el-form-item :label="$t('iteration.iterationName')" prop="name">
        <el-input v-model="form.name" :placeholder="$t('iteration.enterIterationName')" />
      </el-form-item>

      <el-form-item :label="$t('iteration.description')">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          :placeholder="$t('iteration.enterDescription')"
        />
      </el-form-item>

      <el-form-item :label="$t('iteration.goal')">
        <el-input
          v-model="form.goal"
          :placeholder="$t('iteration.enterGoal')"
        />
      </el-form-item>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item :label="$t('iteration.startDate')" prop="start_date">
            <el-date-picker
              v-model="form.start_date"
              type="date"
              :placeholder="$t('iteration.selectStartDate')"
              style="width: 100%"
              value-format="YYYY-MM-DD"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="$t('iteration.endDate')" prop="end_date">
            <el-date-picker
              v-model="form.end_date"
              type="date"
              :placeholder="$t('iteration.selectEndDate')"
              style="width: 100%"
              value-format="YYYY-MM-DD"
            />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item :label="$t('iteration.status')" v-if="isEditing">
        <el-select v-model="form.status" style="width: 100%">
          <el-option label="计划中" value="PLANNED" />
          <el-option label="进行中" value="ACTIVE" />
          <el-option label="已完成" value="COMPLETED" />
          <el-option label="已归档" value="ARCHIVED" />
        </el-select>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleCancel">{{ $t('common.cancel') }}</el-button>
      <el-button type="primary" :disabled="loading" @click="handleSubmit">
        {{ loading ? (isEditing ? $t('common.saving', '保存中...') : $t('common.creating', '创建中...')) : (isEditing ? $t('common.save') : $t('common.create')) }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  iteration: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'submit', 'cancel'])

const { t } = useI18n()

const formRef = ref(null)

const form = ref({
  name: '',
  description: '',
  goal: '',
  start_date: '',
  end_date: '',
  status: 'PLANNED'
})

const rules = {
  name: [
    { required: true, message: t('validation.required'), trigger: 'blur' }
  ]
}

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const isEditing = computed(() => !!props.iteration?.id)

const resetForm = () => {
  form.value = {
    name: '',
    description: '',
    goal: '',
    start_date: '',
    end_date: '',
    status: 'PLANNED'
  }
}

watch(() => props.iteration, (newIteration) => {
  if (newIteration) {
    form.value = {
      name: newIteration.name || '',
      description: newIteration.description || '',
      goal: newIteration.goal || '',
      start_date: newIteration.start_date || '',
      end_date: newIteration.end_date || '',
      status: newIteration.status || 'PLANNED'
    }
  } else {
    resetForm()
  }
}, { immediate: true })

const handleSubmit = async () => {
  try {
    await formRef.value.validate()
    emit('submit', form.value)
  } catch {
    // Validation failed
  }
}

const handleCancel = () => {
  emit('cancel')
  emit('update:modelValue', false)
}
</script>
