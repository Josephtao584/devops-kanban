import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../src/locales/zh.js'

const mockMcpServerApi = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  validate: vi.fn()
}))

vi.mock('../src/api/mcpServer', () => ({ mcpServerApi: mockMcpServerApi }))

import McpServerConfig from '../src/views/McpServerConfig.vue'

function createWrapper() {
  const i18n = createI18n({
    legacy: false,
    locale: 'zh',
    messages: { zh }
  })
  return mount(McpServerConfig, {
    global: {
      plugins: [i18n]
    }
  })
}

describe('McpServerConfig', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('renders server list after loading', async () => {
    mockMcpServerApi.list.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: 'weather-server', server_type: 'stdio', config: { command: 'npx' } },
        { id: 2, name: 'api-server', server_type: 'http', config: { url: 'http://localhost' } }
      ]
    })

    const wrapper = createWrapper()
    await vi.dynamicMockSettle?.() || await new Promise(r => setTimeout(r, 0))

    // Wait for the onMounted fetch to complete
    await vi.waitFor?.(async () => {
      await wrapper.vm.$nextTick()
    }, { timeout: 2000 }) || await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('weather-server')
    expect(wrapper.text()).toContain('api-server')
  })

  it('shows empty message when no servers', async () => {
    mockMcpServerApi.list.mockResolvedValue({
      success: true,
      data: []
    })

    const wrapper = createWrapper()
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    // Should show empty list hint
    expect(wrapper.text()).toContain('暂无')
  })

  it('opens add form when create button clicked', async () => {
    mockMcpServerApi.list.mockResolvedValue({ success: true, data: [] })

    const wrapper = createWrapper()
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    // Click the create button
    const createBtn = wrapper.find('[data-testid="open-create-mcp-server"]')
    expect(createBtn.exists()).toBe(true)
    await createBtn.trigger('click')

    // Form should be visible
    expect(wrapper.find('[data-testid="mcp-server-form"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mcp-server-name-input"]').exists()).toBe(true)
  })

  it('shows stdio fields when server_type is stdio', async () => {
    mockMcpServerApi.list.mockResolvedValue({ success: true, data: [] })

    const wrapper = createWrapper()
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="open-create-mcp-server"]').trigger('click')
    await wrapper.vm.$nextTick()

    // Default server_type is stdio, so command field should be visible (Chinese label: 启动命令)
    const form = wrapper.find('[data-testid="mcp-server-form"]')
    expect(form.text()).toContain('启动命令')
  })

  it('creates server via store on form submit', async () => {
    mockMcpServerApi.list.mockResolvedValue({ success: true, data: [] })
    mockMcpServerApi.create.mockResolvedValue({
      success: true,
      data: { id: 1, name: 'test-server', server_type: 'stdio', config: { command: 'npx' } }
    })

    const wrapper = createWrapper()
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="open-create-mcp-server"]').trigger('click')
    await wrapper.vm.$nextTick()

    // Fill in the form
    const nameInput = wrapper.find('[data-testid="mcp-server-name-input"]')
    await nameInput.setValue('test-server')

    // Submit form
    await wrapper.find('[data-testid="mcp-server-form"]').trigger('submit')
    await wrapper.vm.$nextTick()

    expect(mockMcpServerApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'test-server' })
    )
  })
})
