import { describe, expect, it } from 'vitest'

import { formatTaskDescription } from '../src/utils/taskDescriptionFormatter'

describe('formatTaskDescription', () => {
  it('escapes raw html before applying limited formatting', () => {
    const formatted = formatTaskDescription('<script>alert(1)</script> **安全**\n- 条目')

    expect(formatted).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(formatted).toContain('<strong>安全</strong>')
    expect(formatted).toContain('• 条目')
    expect(formatted).not.toContain('<script>alert(1)</script>')
  })

  it('renders inline code and fenced code blocks safely', () => {
    const formatted = formatTaskDescription('`npm test`\n```html\n<div>safe</div>\n```')

    expect(formatted).toContain('<code>npm test</code>')
    expect(formatted).toContain('<pre><code>&lt;div&gt;safe&lt;/div&gt;</code></pre>')
    expect(formatted).not.toContain('<div>safe</div>')
  })

  it('renders headings, emphasis, and line breaks from normalized text', () => {
    const formatted = formatTaskDescription('## 标题\n\n**重点**\n*说明*')

    expect(formatted).toContain('<strong>标题</strong>')
    expect(formatted).toContain('<strong>重点</strong>')
    expect(formatted).toContain('<em>说明</em>')
    expect(formatted).toContain('<br><br>')
  })
})
