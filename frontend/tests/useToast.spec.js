import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockElMessage = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn()
}))

vi.mock('element-plus', () => ({
  ElMessage: Object.assign(
    (opts) => mockElMessage[opts.type](opts.message),
    mockElMessage
  )
}))

import { useToast } from '../src/composables/ui/useToast'

describe('useToast', () => {
  let toast

  beforeEach(() => {
    vi.clearAllMocks()
    toast = useToast()
  })

  it('success calls ElMessage.success', () => {
    toast.success('done')
    expect(mockElMessage.success).toHaveBeenCalledWith('done')
  })

  it('error calls ElMessage.error', () => {
    toast.error('fail')
    expect(mockElMessage.error).toHaveBeenCalledWith('fail')
  })

  it('warning calls ElMessage.warning', () => {
    toast.warning('warn')
    expect(mockElMessage.warning).toHaveBeenCalledWith('warn')
  })

  it('info calls ElMessage.info', () => {
    toast.info('info msg')
    expect(mockElMessage.info).toHaveBeenCalledWith('info msg')
  })

  it('notify calls ElMessage with type', () => {
    toast.notify('hello', 'success')
    expect(mockElMessage.success).toHaveBeenCalledWith('hello')
  })

  describe('apiError', () => {
    it('extracts message from error.response.data.message', () => {
      const error = { response: { data: { message: 'Backend error' } } }
      const result = toast.apiError(error)
      expect(result).toBe('Backend error')
    })

    it('extracts message from error.response.data.error', () => {
      const error = { response: { data: { error: 'Backend error field' } } }
      const result = toast.apiError(error)
      expect(result).toBe('Backend error field')
    })

    it('extracts message from error.message', () => {
      const error = new Error('Client error')
      const result = toast.apiError(error)
      expect(result).toBe('Client error')
    })

    it('handles string error', () => {
      const result = toast.apiError('string error')
      expect(result).toBe('string error')
    })

    it('returns default for null error', () => {
      const result = toast.apiError(null)
      expect(result).toBe('操作失败')
    })

    it('returns custom default message', () => {
      const result = toast.apiError(null, 'Custom default')
      expect(result).toBe('Custom default')
    })
  })

  describe('fromResponse', () => {
    it('returns true for successful response', () => {
      const result = toast.fromResponse({ success: true }, 'Saved!')
      expect(result).toBe(true)
      expect(mockElMessage.success).toHaveBeenCalledWith('Saved!')
    })

    it('returns false for failed response with message', () => {
      const result = toast.fromResponse({ success: false, message: 'Failed' })
      expect(result).toBe(false)
      expect(mockElMessage.error).toHaveBeenCalledWith('Failed')
    })

    it('returns false for failed response with error field', () => {
      const result = toast.fromResponse({ success: false, error: 'Error msg' })
      expect(result).toBe(false)
      expect(mockElMessage.error).toHaveBeenCalledWith('Error msg')
    })

    it('returns false with default message for null response', () => {
      const result = toast.fromResponse(null)
      expect(result).toBe(false)
      expect(mockElMessage.error).toHaveBeenCalledWith('操作失败')
    })
  })
})
