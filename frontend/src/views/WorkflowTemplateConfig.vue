<template>
  <div class="workflow-template-config">
    <div class="page-header">
      <div>
        <h1>{{ $t('workflowTemplate.title') }}</h1>
        <p class="page-description">{{ $t('workflowTemplate.description') }}</p>
      </div>
      <el-button type="primary" :loading="saving" :disabled="loading || !template" @click="saveTemplate">
        {{ $t('common.save') }}
      </el-button>
    </div>

    <el-card class="template-card" shadow="never">
      <template v-if="loading">
        <div class="state-block">{{ $t('common.loading') }}</div>
      </template>

      <template v-else-if="loadError">
        <div class="state-block error">{{ loadError }}</div>
        <div class="actions-row">
          <el-button @click="loadTemplate">{{ $t('workflowTemplate.retry') }}</el-button>
        </div>
      </template>

      <template v-else-if="template">
        <div class="template-meta">
          <div class="meta-row">
            <span class="meta-label">Template ID</span>
            <span class="meta-value">{{ template.template_id }}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">{{ $t('workflowTemplate.name') }}</span>
            <span class="meta-value">{{ template.name }}</span>
          </div>
        </div>

        <el-table :data="template.steps" border stripe>
          <el-table-column prop="name" :label="$t('workflowTemplate.stepName')" min-width="160" />
          <el-table-column prop="id" :label="$t('workflowTemplate.stepId')" min-width="180" />
          <el-table-column :label="$t('workflowTemplate.executor')" min-width="220">
            <template #default="scope">
              <el-select v-model="scope.row.executor.type" style="width: 100%">
                <el-option
                  v-for="option in executorOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { getWorkflowTemplate, updateWorkflowTemplate } from '../api/workflowTemplate'

const { t } = useI18n()

const loading = ref(false)
const saving = ref(false)
const loadError = ref('')
const template = ref(null)

const executorOptions = [
  { value: 'CLAUDE_CODE', label: 'Claude Code' },
  { value: 'CODEX', label: 'Codex' },
  { value: 'OPENCODE', label: 'OpenCode' }
]

const loadTemplate = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const response = await getWorkflowTemplate()
    template.value = response.data
  } catch (error) {
    loadError.value = error.response?.data?.message || t('workflowTemplate.loadFailed')
  } finally {
    loading.value = false
  }
}

const saveTemplate = async () => {
  if (!template.value) return

  saving.value = true
  try {
    const response = await updateWorkflowTemplate(template.value)
    template.value = response.data
    ElMessage.success(t('workflowTemplate.saveSuccess'))
  } catch (error) {
    ElMessage.error(error.response?.data?.message || t('workflowTemplate.saveFailed'))
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadTemplate()
})
</script>

<style scoped>
.workflow-template-config {
  padding: 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
}

.page-header h1 {
  margin: 0 0 8px;
  font-size: 28px;
  font-weight: 600;
}

.page-description {
  margin: 0;
  color: #666;
}

.template-card {
  border-radius: 12px;
}

.template-meta {
  display: grid;
  gap: 8px;
  margin-bottom: 16px;
}

.meta-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.meta-label {
  color: #666;
  min-width: 96px;
}

.meta-value {
  color: #222;
  font-weight: 500;
}

.state-block {
  padding: 32px;
  text-align: center;
  color: #666;
}

.state-block.error {
  color: #d03050;
}

.actions-row {
  display: flex;
  justify-content: center;
  padding-bottom: 24px;
}
</style>
