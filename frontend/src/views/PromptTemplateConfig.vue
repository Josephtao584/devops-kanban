<template>
  <div class="prompt-template-config">
    <div class="header">
      <h1>{{ $t('promptTemplate.title') }}</h1>
      <div class="header-actions">
        <button class="btn btn-primary" @click="initializeDefaults">
          {{ $t('promptTemplate.initializeDefaults') }}
        </button>
      </div>
    </div>

    <!-- Project Selector -->
    <div class="project-selector">
      <label>{{ $t('project.selectProject') }}</label>
      <select v-model="selectedProjectId" @change="loadTemplates">
        <option value="">{{ $t('project.selectProject') }}</option>
        <option v-for="project in projects" :key="project.id" :value="project.id">
          {{ project.name }}
        </option>
      </select>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading">
      {{ $t('common.loading') }}
    </div>

    <!-- Select Project Prompt -->
    <div v-else-if="!selectedProjectId" class="select-project-prompt">
      {{ $t('promptTemplate.selectProjectPrompt') }}
    </div>

    <!-- Templates List -->
    <div v-else class="templates-container">
      <div class="templates-grid">
        <div v-for="template in templates" :key="template.id" class="template-card"
          :class="{ 'is-default': template.isDefault }">
          <div class="card-header">
            <div class="phase-info">
              <span class="phase-badge">{{ $t(`status.${template.phase}`) }}</span>
              <span v-if="template.isDefault" class="default-badge">{{ $t('promptTemplate.default') }}</span>
            </div>
            <div class="card-actions">
              <button class="btn btn-sm btn-secondary" @click="openEditDialog(template)">
                {{ $t('common.edit') }}
              </button>
              <button class="btn btn-sm btn-warning" @click="openResetDialog(template)">
                {{ $t('promptTemplate.reset') }}
              </button>
            </div>
          </div>
          <div class="card-body">
            <div class="instruction-preview">{{ template.instruction }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Dialog -->
    <div v-if="showEditDialog" class="modal-overlay" @click.self="closeEditDialog">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>{{ $t('promptTemplate.editTemplate') }}</h3>
          <button class="close-btn" @click="closeEditDialog">&times;</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="saveTemplate">
            <div class="form-group">
              <label>{{ $t('promptTemplate.phase') }}</label>
              <input v-model="editingTemplate.phase" type="text" disabled />
            </div>
            <div class="form-group">
              <label>{{ $t('promptTemplate.instruction') }}</label>
              <textarea v-model="editingTemplate.instruction" rows="6" required></textarea>
            </div>
            <div class="form-actions">
              <button type="button" class="btn btn-secondary" @click="closeEditDialog">
                {{ $t('common.cancel') }}
              </button>
              <button type="submit" class="btn btn-primary" :disabled="saving">
                {{ saving ? $t('common.loading') : $t('common.save') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Reset Confirmation Dialog -->
    <div v-if="showResetDialog" class="modal-overlay" @click.self="closeResetDialog">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>{{ $t('promptTemplate.resetConfirm') }}</h3>
            <button class="close-btn" @click="closeResetDialog">&times;</button>
          </div>
        <div class="modal-body">
          <p>{{ $t('promptTemplate.resetConfirmMessage') }}</p>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" @click="closeResetDialog">
              {{ $t('common.cancel') }}
            </button>
            <button type="button" class="btn btn-warning" @click="confirmReset" :disabled="saving">
              {{ saving ? $t('common.loading') : $t('promptTemplate.reset') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Toast Notification -->
    <div v-if="toast.show" class="toast" :class="toast.type">
      {{ toast.message }}
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { getProjects } from '../api/project'
import {
  getPromptTemplates,
  updatePromptTemplate,
  resetPromptTemplate
} from '../api/promptTemplate'

const { t } = useI18n()

export default {
  name: 'PromptTemplateConfig',
  setup() {
    const { t } = useI18n()

    const projects = ref([])
    const templates = ref([])
    const selectedProjectId = ref('')
    const loading = ref(false)
    const saving = ref(false)
    const showEditDialog = ref(false)
    const showResetDialog = ref(false)
    const editingTemplate = ref(null)
    const resettingTemplate = ref(null)

    const toast = ref({ show: false, message: '', type: 'success' })

    const showToast = (message, type = 'success') => {
      toast.value = { show: true, message, type }
      setTimeout(() => { toast.value.show = false }, 3000)
    }

    const loadProjects = async () => {
      try {
        const res = await getProjects()
        projects.value = res.data || []
        if (projects.value.length > 0) {
          selectedProjectId.value = projects.value[0].id
          loadTemplates()
        }
      } catch (e) {
        console.error('Failed to load projects:', e)
        showToast(t('promptTemplate.loadFailed'), 'error')
      }
    }

    const loadTemplates = async () => {
      if (!selectedProjectId.value) {
        templates.value = []
        return
      }
      loading.value = true
      try {
        const res = await getPromptTemplates()
        templates.value = res.data || []
      } catch (e) {
        console.error('Failed to load prompt templates:', e)
        showToast(t('promptTemplate.loadFailed'), 'error')
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
      editingTemplate.value = null
    }

    const openResetDialog = (template) => {
      resettingTemplate.value = template
      showResetDialog.value = true
    }

    const closeResetDialog = () => {
      showResetDialog.value = false
      resettingTemplate.value = null
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
          showToast(t('messages.updated', { name: t('promptTemplate.template') }))
          closeEditDialog()
        } else {
          showToast(res.message, 'error')
        }
      } catch (e) {
        console.error('Failed to update template:', e)
        showToast(t('messages.updateFailed', { name: t('promptTemplate.template') }), 'error')
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
          showToast(t('promptTemplate.resetSuccess'))
          closeResetDialog()
        } else {
          showToast(res.message, 'error')
        }
      } catch (e) {
        console.error('Failed to reset template:', e)
        showToast(t('promptTemplate.resetFailed'), 'error')
      } finally {
        saving.value = false
      }
    }

    const initializeDefaults = async () => {
      // This will trigger backend to reinitialize defaults
      loading.value = true
      try {
        await loadTemplates()
        showToast(t('promptTemplate.initializeSuccess'))
      } catch (e) {
        console.error('Failed to initialize defaults:', e)
        showToast(t('promptTemplate.initializeFailed'), 'error')
      } finally {
        loading.value = false
      }
    }

    const selectProject = (projectId) => {
      selectedProjectId.value = projectId
      loadTemplates()
    }

    onMounted(loadProjects)
  }
}
</script>

<style scoped>
.prompt-template-config {
  padding: 1.5rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.header h1 {
  font-size: 1.5rem;
  color: #2d3748;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-primary{
  background: #4299e1;
  color: white;
  border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
}

.btn-primary:hover {
  background: #3577b8;
  padding: 0.75rem 1rem;
}

.project-selector{
  margin-bottom: 1.5rem;
  background: white;
    padding: 1rem;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.project-selector label{
  margin-right: 0.5rem;
    font-weight: 500;
  color: #4a5568;
}

.project-selector select{
    padding: 0.5rem;
    border: 1px solid #cbd5e0;
    border-radius: 4px;
    min-width: 200px;
    font-size: 0.875rem;
}

.loading,
    .select-project-prompt{
    text-align: center;
    padding: 2rem;
    color: #718096;
    background: white;
    border-radius: 8px;
}

.templates-container{
    background: white;
    border-radius: 8px;
    padding: 1rem;
}

.templates-grid{
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
}

.template-card{
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 0;
    transition: box-shadow 0.2s;
    }

.template-card:hover{
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
.is-default{
    border-color: #48bb78;
    background: #f0fff0;
    }
.card-header{
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    background: #f7fafc;
    border-bottom: 1px solid #e2e8f0;
    margin-bottom: 0.5rem;
    }

.phase-info{
    display: flex;
    align-items: center;
    gap: 0.5rem;
    }

.phase-badge{
    background: #4299e1;
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    font-size: 0.875rem;
    font-weight: 500;
    text-transform: uppercase;
    }

.default-badge{
    background: #48bb78;
    color: white;
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    margin-left: 0.5rem;
    }
.card-actions{
    display: flex;
    gap: 0.25rem;
    }
.card-actions .btn-sm{
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
    }

.btn-secondary{
    background: #edf2f7;
    color: #4a5568;
    }

.btn-secondary:hover{
    background: #e2e8f0;
    }

.btn-warning{
    background: #f6ad55;
    color: white;
    }

.btn-warning:hover{
    background: #dd6b20;
    }

.card-body{
    padding: 0.75rem;
    }

.instruction-preview{
    color: #4a5568;
    font-size: 0.875rem;
    line-height: 1.5;
    max-height: 150px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-word;
    }

.modal-overlay{
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    }

.modal{
    background: white;
    border-radius: 8px;
    width: 600px;
    max-width: 90vh;
    max-height: 90vh;
    overflow: auto;
    padding: 0;
    }

.modal-header{
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid #e2e8f0;
    }

.modal-header h3{
    margin: 0;
    font-size: 1.125rem;
    color: #2d3748;
    }
.close-btn{
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #718096;
    padding: 0.25rem;
    }
.close-btn:hover{
    color: #4a5568;
    }
.modal-body{
    padding: 1rem;
    }
.form-group{
    margin-bottom: 1rem;
    }
.form-group label{
    display: block;
    margin-bottom: 0.25rem;
    font-weight: 500;
    color: #4a5568;
    }
.form-group input,
    .form-group textarea{
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #cbd5e0;
    border-radius: 4px;
    font-size: 0.875rem;
    }
.form-group input:disabled{
    background: #f7fafc;
    color: #718096;
    }
.form-group textarea{
    min-height: 120px;
    resize: vertical;
    line-height: 1.5;
    }
.form-actions{
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 1rem;
    }
.toast{
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    padding: 0.75rem 1.5rem;
    background: #48bb78;
    color: white;
    border-radius: 4px;
    font-size: 0.875rem;
    min-width: 200px;
    z-index: 2000;
    animation: slideIn 0.3s ease-out;
    }
.toast.error{
    background: #fc8181;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
