<template>
  <div class="modal-overlay" @click.self="handleCancel">
    <div class="modal-content">
      <div class="modal-header">
        <h3>{{ isEditing ? $t('requirement.editRequirement') : $t('requirement.createRequirement') }}</h3>
        <button class="close-btn" @click="handleCancel">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <form @submit.prevent="handleSubmit" class="requirement-form">
        <div class="form-group">
          <label class="form-label">
            {{ $t('requirement.title') }} <span class="required">*</span>
          </label>
          <input
            v-model="form.title"
            type="text"
            class="form-input"
            :placeholder="$t('requirement.titlePlaceholder')"
            required
          />
          <span v-if="errors.title" class="error-message">{{ errors.title }}</span>
        </div>

        <div class="form-group">
          <label class="form-label">{{ $t('requirement.description') }}</label>
          <textarea
            v-model="form.description"
            class="form-textarea"
            :placeholder="$t('requirement.descriptionPlaceholder')"
            rows="4"
          ></textarea>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">{{ $t('requirement.priority') }}</label>
            <select v-model="form.priority" class="form-select">
              <option v-for="p in priorities" :key="p" :value="p">
                {{ $t(`priority.${p}`) }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">{{ $t('requirement.source') }}</label>
            <select v-model="form.source" class="form-select">
              <option v-for="s in sources" :key="s" :value="s">
                {{ $t(`requirement.sources.${s}`) }}
              </option>
            </select>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn btn-secondary" @click="handleCancel">
            {{ $t('common.cancel') }}
          </button>
          <button type="submit" class="btn btn-primary" :disabled="submitting">
            <svg v-if="submitting" class="icon-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
              <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
            </svg>
            {{ submitting ? $t('common.loading') : $t('common.save') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { REQUIREMENT_PRIORITY, REQUIREMENT_SOURCE, REQUIREMENT_DEFAULTS } from '../../constants/requirement.js'

const props = defineProps({
  requirement: {
    type: Object,
    default: null
  },
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['submit', 'cancel'])

const priorities = Object.values(REQUIREMENT_PRIORITY)
const sources = Object.values(REQUIREMENT_SOURCE)

const isEditing = computed(() => !!props.requirement?.id)

const form = reactive({
  title: '',
  description: '',
  priority: REQUIREMENT_DEFAULTS.priority,
  source: REQUIREMENT_DEFAULTS.source
})

const errors = reactive({
  title: ''
})

const submitting = ref(false)

// Initialize form when requirement prop changes
watch(() => props.requirement, (req) => {
  if (req) {
    form.title = req.title || ''
    form.description = req.description || ''
    form.priority = req.priority || REQUIREMENT_DEFAULTS.priority
    form.source = req.source || REQUIREMENT_DEFAULTS.source
  } else {
    resetForm()
  }
}, { immediate: true })

const resetForm = () => {
  form.title = ''
  form.description = ''
  form.priority = REQUIREMENT_DEFAULTS.priority
  form.source = REQUIREMENT_DEFAULTS.source
  errors.title = ''
}

const validate = () => {
  let valid = true
  errors.title = ''

  if (!form.title.trim()) {
    errors.title = 'Title is required'
    valid = false
  } else if (form.title.length < 3) {
    errors.title = 'Title must be at least 3 characters'
    valid = false
  }

  return valid
}

const handleSubmit = async () => {
  if (!validate()) return

  submitting.value = true
  try {
    emit('submit', {
      ...form,
      id: props.requirement?.id
    })
  } finally {
    submitting.value = false
  }
}

const handleCancel = () => {
  emit('cancel')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: #9ca3af;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #374151;
}

.requirement-form {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.required {
  color: #ef4444;
}

.form-input,
.form-textarea,
.form-select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.2s;
}

.form-input:focus,
.form-textarea:focus,
.form-select:focus {
  outline: none;
  border-color: #f59e0b;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
}

.error-message {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #ef4444;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
}

.btn-secondary {
  background-color: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #e5e7eb;
}

.icon-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
