<template>
  <BaseDialog
    v-model="visible"
    :title="isEditing ? $t('team.editTeam') : $t('team.createTeam')"
    width="500px"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
      <el-form-item :label="$t('team.teamName')" prop="name">
        <el-input v-model="form.name" :placeholder="$t('team.enterName')" maxlength="200" show-word-limit />
      </el-form-item>
      <el-form-item :label="$t('team.description')">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          :placeholder="$t('team.enterDescription')"
          maxlength="5000"
          show-word-limit
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleCancel">{{ $t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="loading" @click="handleSubmit">
        {{ isEditing ? $t('common.save') : $t('common.create') }}
      </el-button>
    </template>
  </BaseDialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseDialog from '../BaseDialog.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  team: { type: Object, default: null },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'submit', 'cancel'])

const { t } = useI18n()

const formRef = ref(null)
const form = ref({ name: '', description: '' })
const rules = { name: [{ required: true, message: t('validation.required'), trigger: 'blur' }] }

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const isEditing = computed(() => !!props.team?.id)

watch(() => props.team, (team) => {
  if (team) {
    form.value = { name: team.name || '', description: team.description || '' }
  } else {
    form.value = { name: '', description: '' }
  }
}, { immediate: true })

const handleSubmit = async () => {
  try {
    await formRef.value.validate()
    emit('submit', { name: form.value.name, description: form.value.description || undefined })
  } catch { /* validation failed */ }
}

const handleCancel = () => {
  emit('cancel')
  emit('update:modelValue', false)
}
</script>
