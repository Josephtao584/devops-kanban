import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request ID counter for tracing
let requestId = 0

// Request interceptor with debug logging
api.interceptors.request.use(
  (config) => {
    config.metadata = {
      requestId: ++requestId,
      startTime: Date.now()
    }
    if (import.meta.env.DEV) {
      console.log(`[API Request #${config.metadata.requestId}]`,
        config.method?.toUpperCase(),
        config.url,
        config.params ? `params: ${JSON.stringify(config.params)}` : '',
        config.data ? `data: ${JSON.stringify(config.data).substring(0, 200)}...` : ''
      )
    }
    return config
  },
  (error) => {
    console.error('[API Request Error]', error)
    return Promise.reject(error)
  }
)

// Response interceptor with debug logging
api.interceptors.response.use(
  (response) => {
    const duration = response.config.metadata ? Date.now() - response.config.metadata.startTime : 0
    const reqId = response.config.metadata?.requestId || '?'
    if (import.meta.env.DEV) {
      console.log(`[API Response #${reqId}]`,
        `${duration}ms`,
        `status: ${response.status}`,
        response.data
      )
    }
    return response.data
  },
  (error) => {
    const config = error.config
    const duration = config?.metadata ? Date.now() - config.metadata.startTime : 0
    const reqId = config?.metadata?.requestId || '?'

    // Enhanced error logging
    console.error(`[API Error #${reqId}]`,
      `${duration}ms`,
      `status: ${error.response?.status}`,
      error.response?.data || error.message
    )

    // Attach request metadata to error for debugging
    error.requestId = reqId
    error.duration = duration

    return Promise.reject(error)
  }
)

export default api