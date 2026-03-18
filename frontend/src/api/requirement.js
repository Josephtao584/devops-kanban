import api from './index.js'

// Requirement API
export const getRequirements = (projectId) => api.get('/requirements', { params: { project_id: projectId } })
export const getRequirement = (id) => api.get(`/requirements/${id}`)
export const createRequirement = (data) => api.post('/requirements', data)
export const updateRequirement = (id, data) => api.put(`/requirements/${id}`, data)
export const deleteRequirement = (id) => api.delete(`/requirements/${id}`)

/**
 * Reorder requirements - batch update order field
 * @param {Array} requirements - Requirements with updated order
 * @returns {Promise} API response
 */
export const reorderRequirements = async (requirements) => {
  // Send batch update request
  const updates = requirements.map((req, index) => ({
    id: req.id,
    order: index
  }))

  return api.put('/requirements/reorder', { updates })
}
