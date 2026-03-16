// Mock API - uses custom axios adapter to intercept all requests
import { mockHandlers } from './handlers.js'

// Parse URL to extract path and query params
const parseRequest = (method, url) => {
  const [path, queryString] = (url || '').split('?')
  const params = {}

  if (queryString) {
    queryString.split('&').forEach(pair => {
      const [key, value] = pair.split('=')
      if (key) {
        params[decodeURIComponent(key)] = decodeURIComponent(value || '')
      }
    })
  }

  return { path, params }
}

// Match request to handler
const matchHandler = (method, path) => {
  const methodUpper = method.toUpperCase()

  // Try exact match first
  const exactKey = `${methodUpper} ${path}`
  if (mockHandlers[exactKey]) {
    return { handler: mockHandlers[exactKey], params: {} }
  }

  // Try pattern match (e.g., /tasks/123 -> /tasks/:id)
  for (const [pattern, handler] of Object.entries(mockHandlers)) {
    const [patternMethod, patternPath] = pattern.split(' ')
    if (patternMethod !== methodUpper) continue

    const patternParts = patternPath.split('/')
    const pathParts = path.split('/')

    if (patternParts.length !== pathParts.length) continue

    const params = {}
    let match = true

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = pathParts[i]
      } else if (patternParts[i] !== pathParts[i]) {
        match = false
        break
      }
    }

    if (match) {
      return { handler, params }
    }
  }

  return { handler: null, params: {} }
}

// Create mock adapter
const createMockAdapter = (originalAdapter) => {
  return async (config) => {
    const { path, params } = parseRequest(config.method, config.url)
    const { handler, params: pathParams } = matchHandler(config.method, path)

    if (handler) {
      console.log(`[Mock] ${config.method?.toUpperCase()} ${path}`)

      try {
        // Combine query params and path params
        const allParams = { ...params, ...pathParams }

        // Parse JSON string data to object (axios stringifies request data)
        let requestData = config.data
        if (typeof config.data === 'string') {
          try {
            requestData = JSON.parse(config.data)
          } catch (e) {
            console.warn('[Mock Adapter] Failed to parse JSON data:', e)
            requestData = config.data
          }
        }

        // Call handler with appropriate arguments
        let result
        if (Object.keys(pathParams).length > 0) {
          // Has path params (e.g., /tasks/:id)
          const id = Object.values(pathParams)[0]
          result = await handler(id, requestData || allParams)
        } else {
          // No path params - use params for GET, data for POST/PUT
          const handlerData = config.params || requestData || allParams
          result = await handler(handlerData)
        }

        // Return mock response
        return Promise.resolve({
          data: result,
          status: 200,
          statusText: 'OK',
          headers: {},
          config
        })
      } catch (err) {
        console.error('[Mock Handler Error]', err)
        return Promise.reject(err)
      }
    }

    // No mock handler found, use original adapter (if any)
    if (originalAdapter) {
      return originalAdapter(config)
    }

    // No handler and no original adapter
    return Promise.reject(new Error(`[Mock] No handler for ${config.method?.toUpperCase()} ${path}`))
  }
}

// Setup mock by replacing axios adapter
export const setupMock = (axiosInstance) => {
  const originalAdapter = axiosInstance.defaults.adapter
  axiosInstance.defaults.adapter = createMockAdapter(originalAdapter)
  console.log('[Mock API] Mock mode enabled')
}

export { resetMockData } from './handlers.js'
