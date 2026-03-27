const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')

const restoreProtectedContent = (content, protectedContent) => content.replace(/@@TASK_FORMAT_TOKEN_(\d+)@@/g, (_match, index) => {
  const token = protectedContent[Number(index)]
  return token || ''
})

const protectContent = (content, protectedContent, html) => {
  const placeholder = `@@TASK_FORMAT_TOKEN_${protectedContent.length}@@`
  protectedContent.push(html)
  return placeholder
}

export const formatTaskDescription = (content) => {
  if (!content) return ''

  const protectedContent = []
  let formatted = escapeHtml(content).replace(/\r\n?/g, '\n')

  formatted = formatted.replace(/```([\w-]*)\n?([\s\S]*?)```/g, (_match, _language, code) => {
    const normalizedCode = String(code).replace(/^\n+|\n+$/g, '')
    return protectContent(formatted, protectedContent, `<pre><code>${normalizedCode}</code></pre>`)
  })

  formatted = formatted.replace(/`([^`]+)`/g, (_match, code) => protectContent(formatted, protectedContent, `<code>${code}</code>`))
  formatted = formatted.replace(/^#{1,6}\s+(.+)$/gm, '<strong>$1</strong>')
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  formatted = formatted.replace(/__(.*?)__/g, '<strong>$1</strong>')
  formatted = formatted.replace(/^(\s*)[-*]\s+(.+)$/gm, '$1• $2')
  formatted = formatted.replace(/\*(\S(?:.*?\S)?)\*/g, '<em>$1</em>')
  formatted = formatted.replace(/\n/g, '<br>')

  return restoreProtectedContent(formatted, protectedContent)
}
