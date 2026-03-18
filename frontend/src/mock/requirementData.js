// Mock requirement data for demo
import { REQUIREMENT_STATUS, REQUIREMENT_PRIORITY, REQUIREMENT_SOURCE } from '../constants/requirement.js'

export const mockRequirements = [
  {
    id: 1,
    projectId: 1,
    title: '实现用户认证系统',
    description: '需要支持用户名密码登录、OAuth第三方登录（GitHub、Google）、记住我功能、密码找回功能',
    status: REQUIREMENT_STATUS.NEW,
    priority: REQUIREMENT_PRIORITY.HIGH,
    source: REQUIREMENT_SOURCE.PRODUCT,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
    convertedTaskIds: [],
    analysisResult: null
  },
  {
    id: 2,
    projectId: 1,
    title: '添加数据报表功能',
    description: '支持任务统计报表、工作量趋势图、导出PDF和Excel格式的报表',
    status: REQUIREMENT_STATUS.NEW,
    priority: REQUIREMENT_PRIORITY.MEDIUM,
    source: REQUIREMENT_SOURCE.BUSINESS,
    createdAt: '2024-02-10T09:00:00Z',
    updatedAt: '2024-02-10T09:00:00Z',
    convertedTaskIds: [],
    analysisResult: null
  },
  {
    id: 3,
    projectId: 1,
    title: '优化页面加载速度',
    description: '当前首页加载时间超过3秒，需要优化到1秒以内，建议使用懒加载和CDN加速',
    status: REQUIREMENT_STATUS.CONVERTED,
    priority: REQUIREMENT_PRIORITY.HIGH,
    source: REQUIREMENT_SOURCE.USER,
    createdAt: '2024-02-20T14:00:00Z',
    updatedAt: '2024-03-01T11:00:00Z',
    convertedTaskIds: [8, 9],
    analysisResult: {
      taskCount: 2,
      suggestions: ['优化前端资源加载', '配置CDN加速']
    }
  },
  {
    id: 4,
    projectId: 2,
    title: 'API限流与熔断机制',
    description: '实现基于令牌桶的限流策略，支持熔断降级，防止系统过载',
    status: REQUIREMENT_STATUS.NEW,
    priority: REQUIREMENT_PRIORITY.HIGH,
    source: REQUIREMENT_SOURCE.TECH,
    createdAt: '2024-03-01T08:00:00Z',
    updatedAt: '2024-03-01T08:00:00Z',
    convertedTaskIds: [],
    analysisResult: null
  }
]

// Helper to generate IDs
let nextRequirementId = 100

export const generateRequirementId = () => nextRequirementId++

/**
 * Get requirements by project ID
 * @param {number} projectId - Project ID
 * @returns {Array} Requirements for the project
 */
export function getRequirementsByProject(projectId) {
  return mockRequirements.filter(req => req.projectId === projectId)
}

/**
 * Get requirement by ID
 * @param {number} id - Requirement ID
 * @returns {Object|null} Requirement object or null
 */
export function getRequirementById(id) {
  return mockRequirements.find(req => req.id === id) || null
}

/**
 * Create a new requirement
 * @param {Object} data - Requirement data
 * @returns {Object} Created requirement
 */
export function createRequirement(data) {
  const now = new Date().toISOString()
  const newRequirement = {
    id: generateRequirementId(),
    projectId: data.projectId,
    title: data.title,
    description: data.description || '',
    status: data.status || REQUIREMENT_STATUS.NEW,
    priority: data.priority || REQUIREMENT_PRIORITY.MEDIUM,
    source: data.source || REQUIREMENT_SOURCE.OTHER,
    createdAt: now,
    updatedAt: now,
    convertedTaskIds: [],
    analysisResult: null
  }
  mockRequirements.push(newRequirement)
  return newRequirement
}

/**
 * Update a requirement
 * @param {number} id - Requirement ID
 * @param {Object} data - Update data
 * @returns {Object|null} Updated requirement or null
 */
export function updateRequirement(id, data) {
  const index = mockRequirements.findIndex(req => req.id === id)
  if (index === -1) return null

  const updated = {
    ...mockRequirements[index],
    ...data,
    updatedAt: new Date().toISOString()
  }
  mockRequirements[index] = updated
  return updated
}

/**
 * Delete a requirement
 * @param {number} id - Requirement ID
 * @returns {boolean} Success status
 */
export function deleteRequirement(id) {
  const index = mockRequirements.findIndex(req => req.id === id)
  if (index === -1) return false
  mockRequirements.splice(index, 1)
  return true
}

/**
 * Convert requirement to tasks (update status)
 * @param {number} id - Requirement ID
 * @param {Array} taskIds - Created task IDs
 * @param {Object} analysisResult - Analysis result
 * @returns {Object|null} Updated requirement or null
 */
export function convertRequirementToTasks(id, taskIds, analysisResult = null) {
  return updateRequirement(id, {
    status: REQUIREMENT_STATUS.CONVERTED,
    convertedTaskIds: taskIds,
    analysisResult
  })
}
