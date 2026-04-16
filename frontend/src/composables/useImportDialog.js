import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'

/**
 * Composable for import dialog components (Bundle, WorkflowTemplate, McpServer).
 * Encapsulates the shared 3-step flow (upload -> preview -> result),
 * file handling, and close/reset behavior.
 *
 * @param {Object} options
 * @param {Object} options.defaultPreviewData - Default shape for previewData ref
 * @param {Object} options.defaultResultData - Default shape for result ref
 * @param {Function} options.onParseFile - async (file, { setPreview, setError }) => void
 * @param {Function} options.onConfirmImport - async ({ previewData, strategy }) => result
 * @param {Function} options.onClose - Optional cleanup callback when dialog closes
 * @param {string} options.errorPrefix - i18n key prefix for error messages (optional)
 *
 * @returns {Object} Import dialog state and handlers
 */
export function useImportDialog({
  defaultPreviewData,
  defaultResultData,
  onParseFile,
  onConfirmImport,
  onClose = null,
  errorPrefix = ''
} = {}) {
  const { t } = useI18n()

  const step = ref('upload')
  const fileInput = ref(null)
  const strategy = ref('copy')
  const importing = ref(false)
  const previewData = ref(defaultPreviewData)
  const result = ref(defaultResultData)

  const triggerFileInput = () => {
    fileInput.value?.click()
  }

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0]
    if (file) parseFile(file)
  }

  const handleDrop = (event) => {
    const file = event.dataTransfer?.files?.[0]
    if (file) parseFile(file)
  }

  const parseFile = async (file) => {
    await onParseFile(file, {
      setPreview: (data) => {
        previewData.value = data
        step.value = 'preview'
      },
      setError: (msg) => {
        ElMessage.error(msg)
      },
      t
    })
  }

  const handleConfirmImport = async () => {
    importing.value = true
    try {
      const importResult = await onConfirmImport({
        previewData: previewData.value,
        strategy: strategy.value
      })
      result.value = importResult
      step.value = 'result'
      return importResult
    } catch (error) {
      ElMessage.error(error?.message || 'Import failed')
    } finally {
      importing.value = false
    }
  }

  const resetToUpload = () => {
    step.value = 'upload'
    previewData.value = defaultPreviewData
    if (fileInput.value) fileInput.value.value = ''
    if (onClose) onClose()
  }

  const handleClose = () => {
    step.value = 'upload'
    previewData.value = defaultPreviewData
    result.value = defaultResultData
    importing.value = false
    if (onClose) onClose()
  }

  return {
    step,
    fileInput,
    strategy,
    importing,
    previewData,
    result,
    triggerFileInput,
    handleFileSelect,
    handleDrop,
    handleConfirmImport,
    resetToUpload,
    handleClose
  }
}
