import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PlanSummary from './PlanSummary.vue'

describe('PlanSummary', () => {
  const defaultPlan = {
    steps: [],
    hasPlan: false,
    currentStep: null
  }

  describe('rendering', () => {
    it('should render nothing when hasPlan is false', () => {
      const wrapper = mount(PlanSummary, {
        props: { plan: defaultPlan }
      })
      expect(wrapper.find('.plan-summary').exists()).toBe(false)
      expect(wrapper.find('.plan-empty').exists()).toBe(true)
      expect(wrapper.find('.plan-empty-text').text()).toBe('暂无计划')
    })

    it('should render plan toggle button when hasPlan is true', () => {
      const plan = {
        steps: [
          { id: 1, title: '第一步', status: 'running', substeps: [] }
        ],
        hasPlan: true,
        currentStep: 1
      }
      const wrapper = mount(PlanSummary, {
        props: { plan }
      })
      expect(wrapper.find('.plan-summary').exists()).toBe(true)
      expect(wrapper.find('.plan-toggle').exists()).toBe(true)
    })

    it('should render plan-empty when plan is empty object', () => {
      const wrapper = mount(PlanSummary, {
        props: { plan: { steps: [], hasPlan: false, currentStep: null } }
      })
      expect(wrapper.find('.plan-empty').exists()).toBe(true)
    })
  })

  describe('toggle behavior', () => {
    it('should start collapsed', () => {
      const plan = {
        steps: [{ id: 1, title: '第一步', status: 'running', substeps: [] }],
        hasPlan: true,
        currentStep: 1
      }
      const wrapper = mount(PlanSummary, {
        props: { plan }
      })
      expect(wrapper.find('.plan-content').exists()).toBe(false)
    })

    it('should expand on click', async () => {
      const plan = {
        steps: [{ id: 1, title: '第一步', status: 'running', substeps: [] }],
        hasPlan: true,
        currentStep: 1
      }
      const wrapper = mount(PlanSummary, {
        props: { plan }
      })
      await wrapper.find('.plan-toggle').trigger('click')
      expect(wrapper.find('.plan-content').exists()).toBe(true)
    })

    it('should collapse on second click', async () => {
      const plan = {
        steps: [{ id: 1, title: '第一步', status: 'running', substeps: [] }],
        hasPlan: true,
        currentStep: 1
      }
      const wrapper = mount(PlanSummary, {
        props: { plan }
      })
      await wrapper.find('.plan-toggle').trigger('click')
      await wrapper.find('.plan-toggle').trigger('click')
      expect(wrapper.find('.plan-content').exists()).toBe(false)
    })
  })

  describe('step rendering', () => {
    it('should render step number and title', async () => {
      const plan = {
        steps: [{ id: 1, title: '分析需求', status: 'running', substeps: [] }],
        hasPlan: true,
        currentStep: 1
      }
      const wrapper = mount(PlanSummary, {
        props: { plan }
      })
      await wrapper.find('.plan-toggle').trigger('click')

      expect(wrapper.find('.step-number').text()).toBe('1.')
      expect(wrapper.find('.step-title').text()).toBe('分析需求')
    })

    it('should render multiple steps', async () => {
      const plan = {
        steps: [
          { id: 1, title: '第一步', status: 'completed', substeps: [] },
          { id: 2, title: '第二步', status: 'running', substeps: [] }
        ],
        hasPlan: true,
        currentStep: 2
      }
      const wrapper = mount(PlanSummary, {
        props: { plan }
      })
      await wrapper.find('.plan-toggle').trigger('click')

      const stepHeaders = wrapper.findAll('.step-header')
      expect(stepHeaders.length).toBe(2)
      expect(stepHeaders[0].find('.step-title').text()).toBe('第一步')
      expect(stepHeaders[1].find('.step-title').text()).toBe('第二步')
    })

    it('should show completed icon for completed step', async () => {
      const plan = {
        steps: [{ id: 1, title: '已完成', status: 'completed', substeps: [] }],
        hasPlan: true,
        currentStep: 1
      }
      const wrapper = mount(PlanSummary, {
        props: { plan }
      })
      await wrapper.find('.plan-toggle').trigger('click')

      expect(wrapper.find('.step-status-icon').text()).toBe('✅')
    })

    it('should show running icon for running step', async () => {
      const plan = {
        steps: [{ id: 1, title: '进行中', status: 'running', substeps: [] }],
        hasPlan: true,
        currentStep: 1
      }
      const wrapper = mount(PlanSummary, {
        props: { plan }
      })
      await wrapper.find('.plan-toggle').trigger('click')

      expect(wrapper.find('.step-status-icon').text()).toBe('🔄')
    })

    it('should show pending icon for pending step', async () => {
      const plan = {
        steps: [{ id: 1, title: '待开始', status: 'pending', substeps: [] }],
        hasPlan: true,
        currentStep: 1
      }
      const wrapper = mount(PlanSummary, {
        props: { plan }
      })
      await wrapper.find('.plan-toggle').trigger('click')

      expect(wrapper.find('.step-status-icon').text()).toBe('⏳')
    })
  })

  describe('substep rendering', () => {
    it('should render substeps when present', async () => {
      const plan = {
        steps: [
          {
            id: 1,
            title: '创建文件',
            status: 'running',
            substeps: [
              { id: 1, title: 'main.js', status: 'completed' },
              { id: 2, title: 'handler.js', status: 'running' }
            ]
          }
        ],
        hasPlan: true,
        currentStep: 1
      }
      const wrapper = mount(PlanSummary, {
        props: { plan }
      })
      await wrapper.find('.plan-toggle').trigger('click')

      const substeps = wrapper.findAll('.substep')
      expect(substeps.length).toBe(2)
      expect(substeps[0].find('.substep-title').text()).toBe('main.js')
      expect(substeps[1].find('.substep-title').text()).toBe('handler.js')
    })

    it('should not render substeps section when empty', async () => {
      const plan = {
        steps: [{ id: 1, title: '第一步', status: 'running', substeps: [] }],
        hasPlan: true,
        currentStep: 1
      }
      const wrapper = mount(PlanSummary, {
        props: { plan }
      })
      await wrapper.find('.plan-toggle').trigger('click')

      expect(wrapper.find('.step-substeps').exists()).toBe(false)
    })
  })

  describe('current step hint', () => {
    it('should show current step title in toggle button', () => {
      const plan = {
        steps: [{ id: 1, title: '分析需求', status: 'running', substeps: [] }],
        hasPlan: true,
        currentStep: 1
      }
      const wrapper = mount(PlanSummary, {
        props: { plan }
      })
      expect(wrapper.find('.current-step-hint').text()).toBe('分析需求')
    })

    it('should show current step title after step completes', async () => {
      const plan = {
        steps: [
          { id: 1, title: '第一步', status: 'completed', substeps: [] },
          { id: 2, title: '第二步', status: 'running', substeps: [] }
        ],
        hasPlan: true,
        currentStep: 2
      }
      const wrapper = mount(PlanSummary, {
        props: { plan }
      })
      expect(wrapper.find('.current-step-hint').text()).toBe('第二步')
    })

    it('should not show hint when no current step', () => {
      const plan = {
        steps: [],
        hasPlan: true,
        currentStep: null
      }
      const wrapper = mount(PlanSummary, {
        props: { plan }
      })
      expect(wrapper.find('.current-step-hint').exists()).toBe(false)
    })
  })

  describe('plan without step title', () => {
    it('should show "步骤 N" when title is empty', async () => {
      const plan = {
        steps: [{ id: 1, title: '', status: 'running', substeps: [] }],
        hasPlan: true,
        currentStep: 1
      }
      const wrapper = mount(PlanSummary, {
        props: { plan }
      })
      await wrapper.find('.plan-toggle').trigger('click')

      expect(wrapper.find('.step-title').text()).toBe('步骤 1')
    })
  })
})
