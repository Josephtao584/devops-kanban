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
        <el-input v-model="form.name" :placeholder="$t('project.enterName')" maxlength="200" show-word-limit />
      </el-form-item>

      <el-form-item :label="$t('project.description')">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          :placeholder="$t('project.enterDescription')"
          maxlength="5000"
          show-word-limit
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
          maxlength="2000"
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
          maxlength="2000"
        >
          <template #prefix>
            <el-icon><FolderOpened /></el-icon>
          </template>
        </el-input>
      </el-form-item>

      <el-divider v-if="!isEditing" />

      <el-divider>
        <el-icon><Setting /></el-icon>
        {{ $t('project.env') }}
      </el-divider>

      <el-form-item :label="$t('project.env')">
        <div class="env-editor">
          <div v-for="(item, index) in form.envPairs" :key="index" class="env-pair-row">
            <el-input v-model="item.key" :placeholder="$t('agent.envKey')" class="env-input" />
            <span class="env-eq">=</span>
            <el-input v-model="item.value" :placeholder="$t('agent.envValue')" class="env-input" />
            <button type="button" class="env-remove-btn" @click="removeEnvPair(index)">×</button>
          </div>
          <el-button size="small" @click="addEnvPair">+ {{ $t('common.add') }}</el-button>
        </div>
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
import { Link, FolderOpened, Setting } from '@element-plus/icons-vue'
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
  createExplorationTask: false,
  envPairs: []
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
    createExplorationTask: false,
    envPairs: []
  }
}

watch(() => props.project, (newProject) => {
  if (newProject) {
    const envPairs = newProject.env && typeof newProject.env === 'object'
      ? Object.entries(newProject.env).map(([key, value]) => ({ key, value: String(value) }))
      : []
    form.value = {
      name: newProject.name || '',
      description: newProject.description || '',
      gitUrl: newProject.gitUrl || newProject.git_url || newProject.repoUrl || '',
      localPath: newProject.localPath || newProject.local_path || '',
      envPairs
    }
  } else {
    resetForm()
  }
}, { immediate: true })

const handleSubmit = async () => {
  try {
    await formRef.value.validate()
    const env = {}
    for (const pair of form.value.envPairs) {
      if (pair.key.trim()) {
        env[pair.key.trim()] = pair.value
      }
    }
    const submitData = {
      name: form.value.name,
      description: form.value.description,
      createExplorationTask: form.value.createExplorationTask,
      env: Object.keys(env).length > 0 ? env : undefined
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

const addEnvPair = () => { form.value.envPairs.push({ key: '', value: '' }) }
const removeEnvPair = (index) => { form.value.envPairs.splice(index, 1) }
</script>

<style scoped>
.env-pair-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.env-input {
  flex: 1;
}
.env-eq {
  color: var(--el-text-color-secondary);
  font-weight: bold;
}
.env-remove-btn {
  border: none;
  background: none;
  color: var(--el-color-danger);
  cursor: pointer;
  font-size: 18px;
  padding: 0 4px;
}
.env-remove-btn:hover {
  color: var(--el-color-danger-dark-2);
}
</style>
