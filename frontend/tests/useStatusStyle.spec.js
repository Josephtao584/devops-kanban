import { describe, expect, it } from 'vitest'
import { useStatusStyle } from '../src/composables/useStatusStyle'

describe('useStatusStyle', () => {
  const { getStatusClass, getStatusColor, getStatusBorderColor, getStatusBackground } = useStatusStyle()

  describe('getStatusClass', () => {
    it('returns correct class for each status', () => {
      expect(getStatusClass('TODO')).toBe('status-todo')
      expect(getStatusClass('IN_PROGRESS')).toBe('status-in-progress')
      expect(getStatusClass('DONE')).toBe('status-done')
      expect(getStatusClass('BLOCKED')).toBe('status-blocked')
      expect(getStatusClass('REQUIREMENT')).toBe('status-requirement')
    })

    it('returns status-unknown for unknown status', () => {
      expect(getStatusClass('UNKNOWN')).toBe('status-unknown')
      expect(getStatusClass(null)).toBe('status-unknown')
      expect(getStatusClass(undefined)).toBe('status-unknown')
    })
  })

  describe('getStatusColor', () => {
    it('returns color config for known statuses', () => {
      const result = getStatusColor('TODO')
      expect(result).toHaveProperty('bg')
      expect(result).toHaveProperty('color')
    })

    it('returns fallback for unknown status', () => {
      const result = getStatusColor('UNKNOWN')
      expect(result).toEqual({
        bg: 'var(--el-fill-color)',
        color: 'var(--el-text-color-placeholder)'
      })
    })
  })

  describe('getStatusBorderColor', () => {
    it('returns border color for known statuses', () => {
      expect(getStatusBorderColor('TODO')).toBe('var(--todo-strong)')
      expect(getStatusBorderColor('BLOCKED')).toBe('#ef4444')
    })

    it('returns fallback for unknown status', () => {
      expect(getStatusBorderColor('UNKNOWN')).toBe('var(--accent-color)')
    })
  })

  describe('getStatusBackground', () => {
    it('returns gradient for known statuses', () => {
      expect(getStatusBackground('TODO')).toContain('yellow-accent-mid')
      expect(getStatusBackground('DONE')).toContain('teal-accent-strong')
    })

    it('returns fallback gradient for unknown status', () => {
      const result = getStatusBackground('UNKNOWN')
      expect(result).toContain('linear-gradient')
    })
  })
})
