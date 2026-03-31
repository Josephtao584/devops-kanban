import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { usePlanParser } from './usePlanParser.js'

describe('usePlanParser', () => {
  function createEvents(events) {
    return ref(events)
  }

  describe('STEP parsing', () => {
    it('should parse a single step', () => {
      const events = createEvents([
        { id: 1, kind: 'message', content: '[STEP 1] 分析需求', seq: 1 }
      ])
      const { plan } = usePlanParser(events)
      expect(plan.value.hasPlan).toBe(true)
      expect(plan.value.steps.length).toBe(1)
      expect(plan.value.steps[0].id).toBe(1)
      expect(plan.value.steps[0].title).toBe('分析需求')
      expect(plan.value.steps[0].status).toBe('running')
    })

    it('should sort steps by step number even when messages arrive out of order', () => {
      const events = createEvents([
        { id: 1, kind: 'message', content: '[STEP 2] 第二步', seq: 1 },
        { id: 2, kind: 'message', content: '[STEP 1] 第一步', seq: 2 }
      ])
      const { plan } = usePlanParser(events)
      expect(plan.value.steps.map((step) => step.id)).toEqual([1, 2])
      expect(plan.value.steps[0].status).toBe('completed')
      expect(plan.value.steps[1].status).toBe('running')
    })

    it('should update an existing step title when a later marker provides one', () => {
      const events = createEvents([
        { id: 1, kind: 'message', content: '[STEP 1]', seq: 1 },
        { id: 2, kind: 'message', content: '[STEP 1] 分析需求', seq: 2 }
      ])
      const { plan } = usePlanParser(events)
      expect(plan.value.steps[0].title).toBe('分析需求')
      expect(plan.value.steps[0].status).toBe('running')
    })

    it('should parse multiple steps in order', () => {
      const events = createEvents([
        { id: 1, kind: 'message', content: '[STEP 1] 第一步', seq: 1 },
        { id: 2, kind: 'message', content: '[STEP 2] 第二步', seq: 2 },
        { id: 3, kind: 'message', content: '[STEP 3] 第三步', seq: 3 }
      ])
      const { plan } = usePlanParser(events)
      expect(plan.value.steps.length).toBe(3)
      expect(plan.value.steps[0].id).toBe(1)
      expect(plan.value.steps[1].id).toBe(2)
      expect(plan.value.steps[2].id).toBe(3)
      expect(plan.value.steps[2].status).toBe('running')
    })

    it('should parse step with DONE marker', () => {
      const events = createEvents([
        { id: 1, kind: 'message', content: '[STEP 1] 第一步 DONE', seq: 1 },
        { id: 2, kind: 'message', content: '[STEP 2] 第二步', seq: 2 }
      ])
      const { plan } = usePlanParser(events)
      expect(plan.value.steps[0].status).toBe('completed')
      expect(plan.value.steps[1].status).toBe('running')
    })

    it('should mark an existing step as completed when a later marker adds DONE', () => {
      const events = createEvents([
        { id: 1, kind: 'message', content: '[STEP 1] 第一步', seq: 1 },
        { id: 2, kind: 'message', content: '[STEP 1] 第一步 DONE', seq: 2 }
      ])
      const { plan } = usePlanParser(events)
      expect(plan.value.steps[0].status).toBe('completed')
      expect(plan.value.currentStep).toBe(null)
    })

    it('should parse step without title', () => {
      const events = createEvents([
        { id: 1, kind: 'message', content: '[STEP 1]', seq: 1 }
      ])
      const { plan } = usePlanParser(events)
      expect(plan.value.steps[0].title).toBe('')
      expect(plan.value.steps[0].status).toBe('running')
    })

    it('should handle step in multiline content', () => {
      const events = createEvents([
        { id: 1, kind: 'message', content: 'Hello\n[STEP 1] 分析需求\nHow are you?', seq: 1 }
      ])
      const { plan } = usePlanParser(events)
      expect(plan.value.hasPlan).toBe(true)
      expect(plan.value.steps[0].title).toBe('分析需求')
    })
  })

  describe('SUBSTEP parsing', () => {
    it('should parse substep under step', () => {
      const events = createEvents([
        { id: 1, kind: 'message', content: '[STEP 1] 分析需求', seq: 1 },
        { id: 2, kind: 'message', content: '[SUBSTEP 1-1] 理解项目结构', seq: 2 }
      ])
      const { plan } = usePlanParser(events)
      expect(plan.value.steps[0].substeps.length).toBe(1)
      expect(plan.value.steps[0].substeps[0].id).toBe(1)
      expect(plan.value.steps[0].substeps[0].title).toBe('理解项目结构')
    })

    it('should parse multiple substeps under same step', () => {
      const events = createEvents([
        { id: 1, kind: 'message', content: '[STEP 1] 创建文件', seq: 1 },
        { id: 2, kind: 'message', content: '[SUBSTEP 1-1] main.js', seq: 2 },
        { id: 3, kind: 'message', content: '[SUBSTEP 1-2] handler.js', seq: 3 }
      ])
      const { plan } = usePlanParser(events)
      expect(plan.value.steps[0].substeps.length).toBe(2)
      expect(plan.value.steps[0].substeps[0].title).toBe('main.js')
      expect(plan.value.steps[0].substeps[1].title).toBe('handler.js')
    })

    it('should deduplicate repeated substep markers', () => {
      const events = createEvents([
        { id: 1, kind: 'message', content: '[STEP 1] 创建文件', seq: 1 },
        { id: 2, kind: 'message', content: '[SUBSTEP 1-1] main.js', seq: 2 },
        { id: 3, kind: 'message', content: '[SUBSTEP 1-1] main.js', seq: 3 }
      ])
      const { plan } = usePlanParser(events)
      expect(plan.value.steps[0].substeps).toHaveLength(1)
      expect(plan.value.steps[0].substeps[0].title).toBe('main.js')
    })

    it('should parse substeps across different steps', () => {
      const events = createEvents([
        { id: 1, kind: 'message', content: '[STEP 1] 步骤一', seq: 1 },
        { id: 2, kind: 'message', content: '[SUBSTEP 1-1] 子步骤1-1', seq: 2 },
        { id: 3, kind: 'message', content: '[STEP 2] 步骤二', seq: 3 },
        { id: 4, kind: 'message', content: '[SUBSTEP 2-1] 子步骤2-1', seq: 4 }
      ])
      const { plan } = usePlanParser(events)
      expect(plan.value.steps[0].substeps.length).toBe(1)
      expect(plan.value.steps[1].substeps.length).toBe(1)
      expect(plan.value.steps[1].substeps[0].title).toBe('子步骤2-1')
    })

    it('should handle substep without title', () => {
      const events = createEvents([
        { id: 1, kind: 'message', content: '[STEP 1] 步骤一', seq: 1 },
        { id: 2, kind: 'message', content: '[SUBSTEP 1-1]', seq: 2 }
      ])
      const { plan } = usePlanParser(events)
      expect(plan.value.steps[0].substeps[0].title).toBe('')
    })
  })

  describe('graceful degradation', () => {
    it('should return hasPlan false when no events', () => {
      const events = createEvents([])
      const { plan } = usePlanParser(events)
      expect(plan.value.hasPlan).toBe(false)
      expect(plan.value.steps.length).toBe(0)
    })

    it('should return hasPlan false when no STEP markers', () => {
      const events = createEvents([
        { id: 1, kind: 'message', content: 'Hello, how can I help you?', seq: 1 }
      ])
      const { plan } = usePlanParser(events)
      expect(plan.value.hasPlan).toBe(false)
    })

    it('should handle events with null content', () => {
      const events = createEvents([
        { id: 1, kind: 'message', content: null, seq: 1 }
      ])
      const { plan } = usePlanParser(events)
      expect(plan.value.hasPlan).toBe(false)
    })

    it('should handle events with non-string content', () => {
      const events = createEvents([
        { id: 1, kind: 'message', content: 123, seq: 1 }
      ])
      const { plan } = usePlanParser(events)
      expect(plan.value.hasPlan).toBe(false)
    })
  })

  describe('step status logic', () => {
    it('should mark current step as running', () => {
      const events = createEvents([
        { id: 1, kind: 'message', content: '[STEP 1] 第一步', seq: 1 },
        { id: 2, kind: 'message', content: '[STEP 2] 第二步', seq: 2 }
      ])
      const { plan } = usePlanParser(events)
      expect(plan.value.steps[0].status).toBe('completed')
      expect(plan.value.steps[1].status).toBe('running')
      expect(plan.value.currentStep).toBe(2)
    })

    it('should handle only one step as running', () => {
      const events = createEvents([
        { id: 1, kind: 'message', content: '[STEP 1] 第一步', seq: 1 }
      ])
      const { plan } = usePlanParser(events)
      expect(plan.value.steps[0].status).toBe('running')
    })

    it('should react when new events are appended to the source ref', async () => {
      const events = createEvents([
        { id: 1, kind: 'message', content: '[STEP 1] 第一步', seq: 1 }
      ])
      const { plan } = usePlanParser(events)

      expect(plan.value.currentStep).toBe(1)
      expect(plan.value.steps[0].status).toBe('running')

      events.value = [
        ...events.value,
        { id: 2, kind: 'message', content: '[STEP 2] 第二步', seq: 2 }
      ]

      await Promise.resolve()

      expect(plan.value.steps[0].status).toBe('completed')
      expect(plan.value.steps[1].status).toBe('running')
      expect(plan.value.currentStep).toBe(2)
    })
  })

  describe('case insensitivity', () => {
    it('should handle lowercase step', () => {
      const events = createEvents([
        { id: 1, kind: 'message', content: '[step 1] 第一步', seq: 1 }
      ])
      const { plan } = usePlanParser(events)
      expect(plan.value.hasPlan).toBe(true)
    })

    it('should handle mixed case done', () => {
      const events = createEvents([
        { id: 1, kind: 'message', content: '[STEP 1] 第一步 done', seq: 1 }
      ])
      const { plan } = usePlanParser(events)
      expect(plan.value.steps[0].status).toBe('completed')
    })
  })
})
