<template>
  <BaseDialog
    v-model="visible"
    :title="isEditing ? $t('project.editProject') : $t('project.createProject')"
    width="500px"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
    >
      <el-form-item :label="$t('project.projectName')" prop="name">
        <el-input v-model="form.name" :placeholder="$t('project.enterName')" />
      </el-form-item>

      <el-form-item :label="$t('project.description')">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          :placeholder="$t('project.enterDescription')"
        />
      </el-form-item>

      <el-divider>
        <el-icon><Link /></el-icon>
        {{ $t('project.gitRepositoryOptional') }}
      </el-divider>

      <el-form-item :label="$t('project.repositoryUrl')">
        <el-input
          v-model="form.gitUrl"
          placeholder="https://github.com/user/repo.git"
          clearable
        >
          <template #prefix>
            <el-icon><Link /></el-icon>
          </template>
        </el-input>
      </el-form-item>

      <el-form-item :label="$t('project.localPath')">
        <el-input
          v-model="form.localPath"
          placeholder="/path/to/local/repo"
          clearable
        >
          <template #prefix>
            <el-icon><FolderOpened /></el-icon>
          </template>
        </el-input>
      </el-form-item>

      <el-divider v-if="!isEditing" />

      <el-checkbox v-if="!isEditing" v-model="form.createExplorationTask" size="large">
        {{ $t('project.createExplorationTask') }}
        <div style="font-size: 12px; color: var(--el-text-color-secondary); font-weight: normal; margin-top: 4px;">
          {{ $t('project.createExplorationTaskHint') }}
        </div>
      </el-checkbox>
    </el-form>

    <template #footer>
      <el-button @click="handleCancel">{{ $t('common.cancel') }}</el-button>
      <el-button type="primary" :disabled="loading" @click="handleSubmit">
        {{ loading ? (isEditing ? $t('common.saving', '保存中...') : $t('common.creating', '创建中...')) : (isEditing ? $t('common.save') : $t('common.create')) }}
      </el-button>
    </template>
  </BaseDialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Link, FolderOpened } from '@element-plus/icons-vue'
import BaseDialog from '../BaseDialog.vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  project: {
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
  gitUrl: '',
  localPath: '',
  createExplorationTask: false
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

const isEditing = computed(() => !!props.project?.id)

const resetForm = () => {
  form.value = {
    name: '',
    description: '',
    gitUrl: '',
    localPath: '',
    createExplorationTask: false
  }
}

watch(() => props.project, (newProject) => {
  if (newProject) {
    form.value = {
      name: newProject.name || '',
      description: newProject.description || '',
      gitUrl: newProject.gitUrl || newProject.git_url || newProject.repoUrl || '',
      localPath: newProject.localPath || newProject.local_path || ''
    }
  } else {
    resetForm()
  }
}, { immediate: true })

const handleSubmit = async () => {
  try {
    await formRef.value.validate()
    // Convert camelCase to snake_case for backend API
    // Only include git_url and local_path if they have values
    const submitData = {
      name: form.value.name,
      description: form.value.description,
      createExplorationTask: form.value.createExplorationTask
    }
    if (form.value.gitUrl) {
      submitData.git_url = form.value.gitUrl
    }
    if (form.value.localPath) {
      submitData.local_path = form.value.localPath
    }
    emit('submit', submitData)
  } catch {
    // Validation failed
  }
}

const handleCancel = () => {
  emit('cancel')
  emit('update:modelValue', false)
}
</script>
