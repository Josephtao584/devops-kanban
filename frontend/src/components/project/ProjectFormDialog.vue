<template>
  <el-dialog
    v-model="visible"
    :title="isEditing ? $t('project.editProject') : $t('project.createProject')"
    width="500px"
    :close-on-click-modal="false"
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
          v-model="form.repoUrl"
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
    </el-form>

    <template #footer>
      <el-button @click="handleCancel">{{ $t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="loading" @click="handleSubmit">
        {{ isEditing ? $t('common.save') : $t('common.create') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Link, FolderOpened } from '@element-plus/icons-vue'

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
  repoUrl: '',
  localPath: ''
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
    repoUrl: '',
    localPath: ''
  }
}

watch(() => props.project, (newProject) => {
  if (newProject) {
    form.value = {
      name: newProject.name || '',
      description: newProject.description || '',
      repoUrl: newProject.repoUrl || '',
      localPath: newProject.localPath || ''
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
