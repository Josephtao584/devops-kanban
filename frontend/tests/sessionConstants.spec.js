import { describe, expect, it } from 'vitest'

import {
  SESSION_STATUS,
  SESSION_INPUT_STATUSES,
  SESSION_BUSY_STATUSES,
  SESSION_TERMINAL_STATUSES
} from '../src/constants/session'

describe('session constants', () => {
  describe('SESSION_INPUT_STATUSES', () => {
    it('contains interactive and resumable statuses', () => {
      expect(SESSION_INPUT_STATUSES).toEqual([
        'RUNNING', 'STOPPED', 'SUSPENDED', 'COMPLETED', 'FAILED', 'CANCELLED'
      ])
    })
  })

  describe('SESSION_BUSY_STATUSES', () => {
    it('contains only RUNNING', () => {
      expect(SESSION_BUSY_STATUSES).toEqual(['RUNNING'])
    })
  })

  describe('SESSION_TERMINAL_STATUSES', () => {
    it('contains STOPPED, ERROR, COMPLETED, FAILED, CANCELLED', () => {
      expect(SESSION_TERMINAL_STATUSES).toContain('STOPPED')
      expect(SESSION_TERMINAL_STATUSES).toContain('ERROR')
      expect(SESSION_TERMINAL_STATUSES).toContain('COMPLETED')
      expect(SESSION_TERMINAL_STATUSES).toContain('FAILED')
      expect(SESSION_TERMINAL_STATUSES).toContain('CANCELLED')
    })
  })

  describe('SESSION_STATUS', () => {
    it('defines all expected statuses', () => {
      expect(SESSION_STATUS.CREATED).toBe('CREATED')
      expect(SESSION_STATUS.RUNNING).toBe('RUNNING')
      expect(SESSION_STATUS.IDLE).toBe('IDLE')
      expect(SESSION_STATUS.STOPPED).toBe('STOPPED')
      expect(SESSION_STATUS.SUSPENDED).toBe('SUSPENDED')
      expect(SESSION_STATUS.ERROR).toBe('ERROR')
      expect(SESSION_STATUS.COMPLETED).toBe('COMPLETED')
      expect(SESSION_STATUS.FAILED).toBe('FAILED')
      expect(SESSION_STATUS.CANCELLED).toBe('CANCELLED')
    })
  })
})
