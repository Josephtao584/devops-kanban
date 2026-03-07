import { ref, reactive, computed } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * Composable for form validation
 * @param {Object} schema - Validation schema defining rules for each field
 * @returns {Object} Form validation utilities
 */
export function useFormValidation(schema) {
  const { t } = useI18n()

  const errors = reactive({})
  const touched = reactive({})
  const dirty = ref(false)

  /**
   * Validate a single field
   * @param {string} field - Field name
   * @param {any} value - Field value
   * @returns {boolean} Whether the field is valid
   */
  function validateField(field, value) {
    const rules = schema[field]
    if (!rules) return true

    for (const rule of rules) {
      if (rule.required && (!value || (typeof value === 'string' && !value.trim()))) {
        errors[field] = rule.message || t('validation.required', 'This field is required')
        return false
      }
      if (rule.minLength && value && value.length < rule.minLength) {
        errors[field] = rule.message || t('validation.minLength', `Minimum ${rule.minLength} characters`)
        return false
      }
      if (rule.maxLength && value && value.length > rule.maxLength) {
        errors[field] = rule.message || t('validation.maxLength', `Maximum ${rule.maxLength} characters`)
        return false
      }
      if (rule.pattern && value && !rule.pattern.test(value)) {
        errors[field] = rule.message || t('validation.pattern', 'Invalid format')
        return false
      }
      if (rule.validator && typeof rule.validator === 'function') {
        const result = rule.validator(value)
        if (result !== true) {
          errors[field] = result || t('validation.invalid', 'Invalid value')
          return false
        }
      }
    }

    delete errors[field]
    return true
  }

  /**
   * Validate all fields in a form
   * @param {Object} formData - Form data object
   * @returns {boolean} Whether all fields are valid
   */
  function validateAll(formData) {
    let isValid = true
    for (const field of Object.keys(schema)) {
      if (!validateField(field, formData[field])) {
        isValid = false
      }
    }
    return isValid
  }

  /**
   * Mark a field as touched
   * @param {string} field - Field name
   */
  function touch(field) {
    touched[field] = true
    dirty.value = true
  }

  /**
   * Clear all validation state
   */
  function reset() {
    Object.keys(errors).forEach(key => delete errors[key])
    Object.keys(touched).forEach(key => delete touched[key])
    dirty.value = false
  }

  /**
   * Check if a field has an error (and has been touched)
   * @param {string} field - Field name
   * @returns {boolean}
   */
  function hasError(field) {
    return touched[field] && !!errors[field]
  }

  /**
   * Get error message for a field
   * @param {string} field - Field name
   * @returns {string|null}
   */
  function getError(field) {
    return touched[field] ? errors[field] || null : null
  }

  /**
   * Whether the form is valid overall
   */
  const isValid = computed(() => Object.keys(errors).length === 0)

  return {
    errors,
    touched,
    dirty,
    isValid,
    validateField,
    validateAll,
    touch,
    reset,
    hasError,
    getError
  }
}

/**
 * Common validation rules
 */
export const commonRules = {
  required: (message) => ({ required: true, message }),
  minLength: (length, message) => ({ minLength: length, message }),
  maxLength: (length, message) => ({ maxLength: length, message }),
  pattern: (regex, message) => ({ pattern: regex, message }),
  email: (message) => ({
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: message || 'Invalid email format'
  }),
  url: (message) => ({
    pattern: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
    message: message || 'Invalid URL format'
  })
}
