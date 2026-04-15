/**
 * Format a date string to locale date string.
 * @param {string|null|undefined} dateStr - ISO date string
 * @param {Object} options
 * @param {string} options.fallback - Value returned for null/empty/invalid dates (default: '')
 * @returns {string}
 */
export function formatDate(dateStr, { fallback = '' } = {}) {
  if (!dateStr) return fallback
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toLocaleDateString()
}

/**
 * Format a date string to locale or ISO-style datetime string.
 * @param {string|null|undefined} dateStr - ISO date string
 * @param {Object} options
 * @param {string} options.fallback - Value returned for null/empty/invalid dates (default: '-')
 * @param {'locale'|'iso'} options.style - 'locale' uses toLocaleString(), 'iso' uses YYYY-MM-DD HH:mm:ss
 * @returns {string}
 */
export function formatDateTime(dateStr, { fallback = '-', style = 'locale' } = {}) {
  if (!dateStr) return fallback
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return fallback

  if (style === 'iso') {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }

  return date.toLocaleString()
}
