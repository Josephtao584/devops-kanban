import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SessionEventRenderer from '../src/components/session/SessionEventRenderer.vue'

const mountRenderer = (event) => mount(SessionEventRenderer, {
  props: { event }
})

describe('SessionEventRenderer', () => {
  it('renders assistant message events as left-aligned chat bubbles', () => {
    const wrapper = mountRenderer({
      id: 1,
      kind: 'message',
      role: 'assistant',
      content: 'Hello from assistant'
    })

    expect(wrapper.find('.event-chat-message').exists()).toBe(true)
    expect(wrapper.find('.event-chat-message').classes()).toContain('align-left')
    expect(wrapper.find('.event-message').classes()).toContain('bubble-assistant')
    expect(wrapper.text()).toContain('Hello from assistant')
  })

  it('renders user message events as right-aligned chat bubbles', () => {
    const wrapper = mountRenderer({
      id: 2,
      kind: 'message',
      role: 'user',
      content: 'Hello from user'
    })

    expect(wrapper.find('.event-chat-message').exists()).toBe(true)
    expect(wrapper.find('.event-chat-message').classes()).toContain('align-right')
    expect(wrapper.find('.event-message').classes()).toContain('bubble-user')
    expect(wrapper.text()).toContain('Hello from user')
  })

  it('renders markdown formatting inside assistant message events', () => {
    const wrapper = mountRenderer({
      id: 20,
      kind: 'message',
      role: 'assistant',
      content: '## 测试结果\n\n**测试执行：**\n\n```python\nprint("HelloWorld")\n```'
    })

    expect(wrapper.find('strong').exists()).toBe(true)
    expect(wrapper.find('pre code').exists()).toBe(true)
    expect(wrapper.html()).toContain('测试结果')
  })

  it('renders line breaks in assistant message events as html breaks', () => {
    const wrapper = mountRenderer({
      id: 21,
      kind: 'message',
      role: 'assistant',
      content: '第一行\n第二行'
    })

    expect(wrapper.html()).toContain('<br>')
  })

  it('does not render markdown syntax literally in assistant message events', () => {
    const wrapper = mountRenderer({
      id: 22,
      kind: 'message',
      role: 'assistant',
      content: '**粗体**'
    })

    expect(wrapper.find('strong').exists()).toBe(true)
    expect(wrapper.html()).not.toContain('**粗体**')
  })

  it('escapes html before rendering markdown in message events', () => {
    const wrapper = mountRenderer({
      id: 23,
      kind: 'message',
      role: 'assistant',
      content: '<script>alert(1)</script> **安全**'
    })

    expect(wrapper.html()).not.toContain('<script>alert(1)</script>')
    expect(wrapper.find('strong').text()).toBe('安全')
  })

  it('keeps markdown rendering scoped to message events', () => {
    const wrapper = mountRenderer({
      id: 24,
      kind: 'status',
      role: 'system',
      content: '**completed**'
    })

    expect(wrapper.find('strong').exists()).toBe(false)
  })

  it('renders code blocks in assistant messages with preserved code text', () => {
    const wrapper = mountRenderer({
      id: 25,
      kind: 'message',
      role: 'assistant',
      content: '```js\nconsole.log("hi")\n```'
    })

    expect(wrapper.find('pre code').text()).toContain('console.log("hi")')
  })

  it('renders inline code in assistant messages', () => {
    const wrapper = mountRenderer({
      id: 26,
      kind: 'message',
      role: 'assistant',
      content: '文件名是 `HelloWorld.py`'
    })

    expect(wrapper.find('code').text()).toBe('HelloWorld.py')
  })

  it('keeps plain text messages readable after markdown formatting', () => {
    const wrapper = mountRenderer({
      id: 27,
      kind: 'message',
      role: 'assistant',
      content: '普通文本消息'
    })

    expect(wrapper.find('.event-content').text()).toContain('普通文本消息')
  })

  it('renders markdown headings as readable text without exposing raw hashes', () => {
    const wrapper = mountRenderer({
      id: 28,
      kind: 'message',
      role: 'assistant',
      content: '## 标题'
    })

    expect(wrapper.html()).not.toContain('## 标题')
    expect(wrapper.text()).toContain('标题')
  })

  it('renders markdown strong text without exposing raw asterisks', () => {
    const wrapper = mountRenderer({
      id: 29,
      kind: 'message',
      role: 'assistant',
      content: '**重点**'
    })

    expect(wrapper.html()).not.toContain('**重点**')
    expect(wrapper.find('strong').text()).toBe('重点')
  })

  it('renders markdown safely for rich workflow assistant replies', () => {
    const wrapper = mountRenderer({
      id: 30,
      kind: 'message',
      role: 'assistant',
      content: '## 代码审查报告\n\n**问题：** 无\n\n`HelloWorld.py`'
    })

    expect(wrapper.html()).toContain('<strong>代码审查报告</strong>')
    expect(wrapper.html()).toContain('<strong>问题：</strong>')
    expect(wrapper.find('code').text()).toBe('HelloWorld.py')
  })

  it('renders markdown lists as readable conversation content', () => {
    const wrapper = mountRenderer({
      id: 31,
      kind: 'message',
      role: 'assistant',
      content: '- 第一项\n- 第二项'
    })

    expect(wrapper.html()).toContain('<br>')
    expect(wrapper.text()).toContain('第一项')
    expect(wrapper.text()).toContain('第二项')
  })

  it('keeps markdown rendering compatible with chat bubble content', () => {
    const wrapper = mountRenderer({
      id: 32,
      kind: 'message',
      role: 'assistant',
      content: '**Bold** with `code`'
    })

    expect(wrapper.find('.event-message').classes()).toContain('bubble-assistant')
    expect(wrapper.find('strong').text()).toBe('Bold')
    expect(wrapper.find('code').text()).toBe('code')
  })

  it('preserves escaped html text while still formatting markdown', () => {
    const wrapper = mountRenderer({
      id: 33,
      kind: 'message',
      role: 'assistant',
      content: '<b>unsafe</b> and **safe**'
    })

    expect(wrapper.html()).not.toContain('<b>unsafe</b>')
    expect(wrapper.find('strong').text()).toBe('safe')
  })

  it('renders markdown code fences without exposing triple backticks', () => {
    const wrapper = mountRenderer({
      id: 34,
      kind: 'message',
      role: 'assistant',
      content: '```python\nprint("HelloWorld")\n```'
    })

    expect(wrapper.html()).not.toContain('```python')
    expect(wrapper.find('pre code').exists()).toBe(true)
  })

  it('keeps message markdown rendering out of system cards', () => {
    const wrapper = mountRenderer({
      id: 35,
      kind: 'tool_call',
      role: 'tool',
      content: '**Read**',
      payload: { name: 'Read' }
    })

    expect(wrapper.find('strong').exists()).toBe(false)
    expect(wrapper.find('.event-system-content').text()).toBe('Read')
  })

  it('renders assistant message markdown inside the chat bubble html', () => {
    const wrapper = mountRenderer({
      id: 36,
      kind: 'message',
      role: 'assistant',
      content: '**加粗**'
    })

    expect(wrapper.find('.event-content').html()).toContain('<strong>加粗</strong>')
  })

  it('keeps user message markdown formatting too', () => {
    const wrapper = mountRenderer({
      id: 37,
      kind: 'message',
      role: 'user',
      content: '**hello**'
    })

    expect(wrapper.find('strong').text()).toBe('hello')
  })

  it('keeps markdown rendering from breaking message alignment classes', () => {
    const wrapper = mountRenderer({
      id: 38,
      kind: 'message',
      role: 'assistant',
      content: '**hello**'
    })

    expect(wrapper.find('.event-chat-message').classes()).toContain('align-left')
  })

  it('keeps markdown rendering from removing chat bubble classes', () => {
    const wrapper = mountRenderer({
      id: 39,
      kind: 'message',
      role: 'assistant',
      content: '**hello**'
    })

    expect(wrapper.find('.event-message').classes()).toContain('bubble-assistant')
  })

  it('renders markdown-rich workflow replies more like the old MessageList formatter', () => {
    const wrapper = mountRenderer({
      id: 40,
      kind: 'message',
      role: 'assistant',
      content: '## 标题\n\n**测试执行：**\n\n`HelloWorld.py`'
    })

    expect(wrapper.html()).toContain('<strong>标题</strong>')
    expect(wrapper.html()).toContain('<strong>测试执行：</strong>')
    expect(wrapper.find('code').text()).toBe('HelloWorld.py')
  })

  it('keeps hashes from showing literally in markdown headings', () => {
    const wrapper = mountRenderer({
      id: 41,
      kind: 'message',
      role: 'assistant',
      content: '## 标题'
    })

    expect(wrapper.html()).not.toContain('## 标题')
  })

  it('keeps fenced code readable in workflow assistant output', () => {
    const wrapper = mountRenderer({
      id: 42,
      kind: 'message',
      role: 'assistant',
      content: '```python\nif __name__ == "__main__":\n    print("HelloWorld")\n```'
    })

    expect(wrapper.find('pre code').text()).toContain('HelloWorld')
  })

  it('preserves markdown formatting for multiline workflow summaries', () => {
    const wrapper = mountRenderer({
      id: 43,
      kind: 'message',
      role: 'assistant',
      content: '**本步骤做了什么：**\n- 审查了文件'
    })

    expect(wrapper.find('strong').text()).toContain('本步骤做了什么：')
    expect(wrapper.text()).toContain('审查了文件')
  })

  it('renders tool_call events as secondary system cards', () => {
    const wrapper = mountRenderer({
      id: 3,
      kind: 'tool_call',
      role: 'tool',
      content: 'call tool',
      payload: { name: 'Read' }
    })

    expect(wrapper.find('.event-system-card').exists()).toBe(true)
    expect(wrapper.classes()).toContain('tone-tool')
    expect(wrapper.find('.event-system-label').text()).toBe('工具调用')
    expect(wrapper.find('.event-system-content').text()).toBe('Read')
  })

  it('renders tool_call events with a dedicated subtle tone class', () => {
    const wrapper = mountRenderer({
      id: 4,
      kind: 'tool_call',
      role: 'tool',
      content: 'call tool',
      payload: { name: 'Read' }
    })

    expect(wrapper.classes()).toContain('tone-tool')
    expect(wrapper.find('.event-system-label').text()).toBe('工具调用')
    expect(wrapper.find('.event-system-content').text()).toBe('Read')
  })

  it('does not expose raw tool_call as the fallback tool name', () => {
    const wrapper = mountRenderer({
      id: 5,
      kind: 'tool_call',
      role: 'tool',
      content: 'call tool',
      payload: {}
    })

    expect(wrapper.find('.event-system-content').text()).not.toBe('tool_call')
  })

  it('does not expose raw completed as the status content', () => {
    const wrapper = mountRenderer({
      id: 6,
      kind: 'status',
      role: 'system',
      content: 'completed'
    })

    expect(wrapper.find('.event-system-content').text()).not.toBe('completed')
  })

  it('renders start-like status events with the start tone class', () => {
    const wrapper = mountRenderer({
      id: 2,
      kind: 'status',
      role: 'system',
      content: '步骤开始执行'
    })

    expect(wrapper.classes()).toContain('tone-status-start')
  })

  it('renders completed status events with the completed tone class', () => {
    const wrapper = mountRenderer({
      id: 3,
      kind: 'status',
      role: 'system',
      content: '步骤已完成'
    })

    expect(wrapper.classes()).toContain('tone-status-completed')
  })

  it('renders failed status events with the failed tone class', () => {
    const wrapper = mountRenderer({
      id: 4,
      kind: 'status',
      role: 'system',
      content: '执行失败：网络异常'
    })

    expect(wrapper.classes()).toContain('tone-status-failed')
  })

  it('falls back to the neutral tone class for unmatched status text', () => {
    const wrapper = mountRenderer({
      id: 5,
      kind: 'status',
      role: 'system',
      content: '等待进一步输入'
    })

    expect(wrapper.classes()).toContain('tone-status-neutral')
  })

  it('renders stream_chunk events in terminal style blocks', () => {
    const wrapper = mountRenderer({
      id: 6,
      kind: 'stream_chunk',
      role: 'assistant',
      content: 'npm test\nPASS',
      payload: { stream: 'stdout' }
    })

    expect(wrapper.find('.event-stream').exists()).toBe(true)
    expect(wrapper.text()).toContain('PASS')
  })
})
