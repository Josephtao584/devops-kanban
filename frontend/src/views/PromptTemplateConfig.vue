<template>
  <div class="prompt-template-config">
    <el-card class="page-header-card">
      <div class="header">
        <h1>{{ $t('promptTemplate.title') }}</h1>
        <el-button type="primary" @click="openInitializeDialog" :loading="loading">
          {{ $t('promptTemplate.initializeDefaults') }}
        </el-button>
      </div>
    </el-card>

    <!-- Loading State -->
    <el-card v-if="loading" class="content-card">
      <div class="loading-state">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>{{ $t('common.loading') }}</span>
      </div>
    </el-card>

    <!-- Empty State -->
    <el-card v-else-if="templates.length === 0" class="content-card">
      <el-empty :description="$t('promptTemplate.noTemplates')">
        <el-button type="primary" @click="openInitializeDialog">
          {{ $t('promptTemplate.initializeDefaults') }}
        </el-button>
      </el-empty>
    </el-card>

    <!-- Templates List -->
    <div v-else class="templates-grid">
      <el-card
        v-for="template in templates"
        :key="template.id"
        class="template-card"
        :class="{ 'is-default': template.isDefault }"
        shadow="hover"
      >
        <template #header>
          <div class="card-header">
            <div class="phase-info">
              <el-tag type="primary" size="large">
                {{ $t(`status.${template.phase}`) }}
              </el-tag>
              <el-tag v-if="template.isDefault" type="success" size="small">
                {{ $t('promptTemplate.default') }}
              </el-tag>
            </div>
            <div class="card-actions">
              <el-button size="small" @click="openEditDialog(template)">
                {{ $t('common.edit') }}
              </el-button>
              <el-button size="small" type="warning" @click="openResetDialog(template)">
                {{ $t('promptTemplate.reset') }}
              </el-button>
            </div>
          </div>
        </template>
        <div class="instruction-content">
          {{ template.instruction }}
        </div>
      </el-card>
    </div>

    <!-- Edit Dialog -->
    <el-dialog
      v-model="showEditDialog"
      :title="$t('promptTemplate.editTemplate')"
      width="600px"
      destroy-on-close
    >
      <el-form :model="editingTemplate" label-width="60px">
        <el-form-item :label="$t('promptTemplate.phase')">
          <el-input v-model="editingTemplate.phase" disabled />
        </el-form-item>
        <el-form-item :label="$t('promptTemplate.instruction')">
          <el-input
            v-model="editingTemplate.instruction"
            type="textarea"
            :rows="8"
            :placeholder="$t('promptTemplate.instructionPlaceholder')"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeEditDialog">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="saveTemplate" :loading="saving">
          {{ $t('common.save') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- Reset Confirmation Dialog -->
    <el-dialog
      v-model="showResetDialog"
      :title="$t('promptTemplate.resetConfirm')"
      width="400px"
    >
      <p>{{ $t('promptTemplate.resetConfirmMessage') }}</p>
      <template #footer>
        <el-button @click="closeResetDialog">{{ $t('common.cancel') }}</el-button>
        <el-button type="warning" @click="confirmReset" :loading="saving">
          {{ $t('promptTemplate.reset') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- Initialize Confirmation Dialog -->
    <el-dialog
      v-model="showInitializeDialog"
      :title="$t('promptTemplate.initializeConfirm')"
      width="400px"
    >
      <p>{{ $t('promptTemplate.initializeConfirmMessage') }}</p>
      <template #footer>
        <el-button @click="closeInitializeDialog">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="confirmInitialize" :loading="loading">
          {{ $t('common.confirm') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import {
  getPromptTemplates,
  updatePromptTemplate,
  resetPromptTemplate,
  initializeDefaults as initializeDefaultsApi
} from '../api/promptTemplate'

export default {
  name: 'PromptTemplateConfig',
  components: {
    Loading
  },
  setup() {
    const { t } = useI18n()

    const templates = ref([])
    const loading = ref(false)
    const saving = ref(false)
    const showEditDialog = ref(false)
    const showResetDialog = ref(false)
    const showInitializeDialog = ref(false)
    const editingTemplate = ref({ id: null, phase: '', instruction: '' })
    const resettingTemplate = ref(null)

    const loadTemplates = async () => {
      loading.value = true
      try {
        const res = await getPromptTemplates()
        templates.value = res.data || []
      } catch (e) {
        console.error('Failed to load prompt templates:', e)
        ElMessage.error(t('promptTemplate.loadFailed'))
      } finally {
        loading.value = false
      }
    }

    const openEditDialog = (template) => {
      editingTemplate.value = { ...template }
      showEditDialog.value = true
    }

    const closeEditDialog = () => {
      showEditDialog.value = false
      editingTemplate.value = { id: null, phase: '', instruction: '' }
    }

    const openResetDialog = (template) => {
      resettingTemplate.value = template
      showResetDialog.value = true
    }

    const closeResetDialog = () => {
      showResetDialog.value = false
      resettingTemplate.value = null
    }

    const openInitializeDialog = () => {
      showInitializeDialog.value = true
    }

    const closeInitializeDialog = () => {
      showInitializeDialog.value = false
    }

    const saveTemplate = async () => {
      if (!editingTemplate.value || !editingTemplate.value.id) {
        return
      }
      saving.value = true
      try {
        const res = await updatePromptTemplate(editingTemplate.value.id, {
          phase: editingTemplate.value.phase,
          instruction: editingTemplate.value.instruction,
          isDefault: false
        })
        if (res.success) {
          const index = templates.value.findIndex(t => t.id === editingTemplate.value.id)
          if (index !== -1) {
            templates.value[index] = res.data
          }
          ElMessage.success(t('messages.updated', { name: t('promptTemplate.template') }))
          closeEditDialog()
        } else {
          ElMessage.error(res.message)
        }
      } catch (e) {
        console.error('Failed to update template:', e)
        ElMessage.error(t('messages.updateFailed', { name: t('promptTemplate.template') }))
      } finally {
        saving.value = false
      }
    }

    const confirmReset = async () => {
      if (!resettingTemplate.value) return

      saving.value = true
      try {
        const res = await resetPromptTemplate(resettingTemplate.value.id)
        if (res.success) {
          const index = templates.value.findIndex(t => t.id === resettingTemplate.value.id)
          if (index !== -1) {
            templates.value[index] = res.data
          }
          ElMessage.success(t('promptTemplate.resetSuccess'))
          closeResetDialog()
        } else {
          ElMessage.error(res.message)
        }
      } catch (e) {
        console.error('Failed to reset template:', e)
        ElMessage.error(t('promptTemplate.resetFailed'))
      } finally {
        saving.value = false
      }
    }

    const confirmInitialize = async () => {
      loading.value = true
      try {
        const res = await initializeDefaultsApi()
        if (res.success) {
          templates.value = res.data || []
          ElMessage.success(t('promptTemplate.initializeSuccess'))
          closeInitializeDialog()
        } else {
          ElMessage.error(res.message)
        }
      } catch (e) {
        console.error('Failed to initialize defaults:', e)
        ElMessage.error(t('promptTemplate.initializeFailed'))
      } finally {
        loading.value = false
      }
    }

    onMounted(loadTemplates)

    return {
      t,
      templates,
      loading,
      saving,
      showEditDialog,
      showResetDialog,
      showInitializeDialog,
      editingTemplate,
      resettingTemplate,
      loadTemplates,
      openEditDialog,
      closeEditDialog,
      openResetDialog,
      closeResetDialog,
      openInitializeDialog,
      closeInitializeDialog,
      saveTemplate,
      confirmReset,
      confirmInitialize
    }
  }
}
</script>

<style scoped>
.prompt-template-config {
  padding: 20px;
  background: #f5f7fa;
  min-height: calc(100vh - 60px);
}

.page-header-card {
  margin-bottom: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header h1 {
  margin: 0;
  font-size: 20px;
  color: #303133;
}

.content-card {
  margin-bottom: 20px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #909399;
}

.loading-state .el-icon {
  font-size: 32px;
  margin-bottom: 10px;
}

.templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
}

.template-card {
  transition: all 0.3s;
}

.template-card.is-default {
  border-left: 4px solid #67c23a;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: nowrap;
  gap: 12px;
}

.phase-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-actions {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  gap: 8px;
}

.instruction-content {
  color: #606266;
  font-size: 14px;
  line-height: 1.6;
  max-height: 180px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 4px;
}

.instruction-content::-webkit-scrollbar {
  width: 6px;
}

.instruction-content::-webkit-scrollbar-thumb {
  background: #dcdfe6;
  border-radius: 3px;
}

.instruction-content::-webkit-scrollbar-track {
  background: #f5f7fa;
}
</style>