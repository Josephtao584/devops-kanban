import api from './index.js'

/**
 * Create a set of CRUD API methods for a given resource path.
 * @param {string} basePath - The base API path (e.g., '/agents')
 * @returns {Object} Object with list, get, create, update, delete methods
 */
export function createCrudApi(basePath) {
  return {
    list: () => api.get(basePath),
    get: (id) => api.get(`${basePath}/${id}`),
    create: (data) => api.post(basePath, data),
    update: (id, data) => api.put(`${basePath}/${id}`, data),
    delete: (id) => api.delete(`${basePath}/${id}`)
  }
}
