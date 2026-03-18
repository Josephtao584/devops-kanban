// Requirement analysis service for demo
import { TASK_CATEGORY, TASK_PRIORITY } from '../constants/task.js'

/**
 * Map requirement priority to task priority
 * @param {string} reqPriority - Requirement priority
 * @returns {string} Task priority
 */
function mapToTaskPriority(reqPriority) {
  // Handle undefined/null case
  if (!reqPriority) {
    return TASK_PRIORITY.MEDIUM
  }

  // If it's already a valid task priority, return as is
  if (Object.values(TASK_PRIORITY).includes(reqPriority)) {
    return reqPriority
  }

  // Map common variations
  const priorityMap = {
    'CRITICAL': TASK_PRIORITY.CRITICAL,
    'URGENT': TASK_PRIORITY.CRITICAL,
    'HIGH': TASK_PRIORITY.HIGH,
    'MEDIUM': TASK_PRIORITY.MEDIUM,
    'NORMAL': TASK_PRIORITY.MEDIUM,
    'LOW': TASK_PRIORITY.LOW
  }

  return priorityMap[reqPriority.toUpperCase()] || TASK_PRIORITY.MEDIUM
}

/**
 * Keyword patterns for detecting task categories
 */
const CATEGORY_PATTERNS = {
  [TASK_CATEGORY.FEATURE]: [
    /实现 | 添加 | 开发 | 创建 | 增加 | 新增 | 支持|feature|implement|add|create|develop|support/i
  ],
  [TASK_CATEGORY.BUG_FIX]: [
    /修复 | 解决|bug|fix|issue|问题 | 错误 | 异常 | 崩溃|crash|error|exception/i
  ],
  [TASK_CATEGORY.DESIGN]: [
    /设计 | 界面|UI|页面 | 样式 | 布局|design|ui|style|layout|前端展示/i
  ],
  [TASK_CATEGORY.TESTING]: [
    /测试 | 单元测试 | 集成测试|test|testing|unit test|integration/i
  ],
  [TASK_CATEGORY.DOCUMENTATION]: [
    /文档 | 说明|readme|doc|documentation|指南 | 手册/i
  ],
  [TASK_CATEGORY.REFACTORING]: [
    /重构 | 优化 | 改进|refactor|optimize|improve|清理/i
  ]
}

/**
 * Feature-specific keywords for task splitting
 */
const FEATURE_KEYWORDS = {
  authentication: /登录 | 认证|auth|login|oauth|sso|token|密码 |password/i,
  ui: /界面 | 页面|ui|前端 | 展示|display|page|view/i,
  api: /api|接口|rest|graphql|endpoint/i,
  database: /数据库 | 存储|database|db|sql|持久化/i,
  notification: /通知 | 消息 | 推送|notification|message|alert/i,
  report: /报表 | 统计 | 报告|report|analytics|dashboard/i,
  export: /导出|export|excel|pdf|csv/i,
  performance: /性能 | 优化 | 缓存|performance|cache|speed/i,
  security: /安全 | 加密 | 权限|security|encrypt|permission/i,
  integration: /集成 | 对接 | 接入|integration|connect|sync/i
}

/**
 * Detect task category from text
 * @param {string} text - Text to analyze
 * @returns {string} Detected category
 */
function detectCategory(text) {
  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return category
      }
    }
  }
  return TASK_CATEGORY.FEATURE
}

/**
 * Analyze requirement and generate a SINGLE task
 * Use requirement title as the task title
 * @param {Object} requirement - The requirement to analyze
 * @returns {Object} Analysis result with task templates
 */
export function analyzeRequirementToTasks(requirement) {
  console.log('[analyzeRequirementToTasks] input requirement:', requirement)
  const tasks = []
  const text = `${requirement.title} ${requirement.description}`.toLowerCase()
  const detectedFeatures = []

  // Detect features from keywords
  for (const [feature, pattern] of Object.entries(FEATURE_KEYWORDS)) {
    if (pattern.test(text)) {
      detectedFeatures.push(feature)
    }
  }

  // Always use requirement title and description as the task
  // Just determine the category based on detected features
  let category = detectCategory(text)

  // Map detected features to categories
  if (detectedFeatures.includes('ui')) {
    category = TASK_CATEGORY.DESIGN
  } else if (detectedFeatures.includes('authentication') ||
             detectedFeatures.includes('api') ||
             detectedFeatures.includes('database') ||
             detectedFeatures.includes('notification') ||
             detectedFeatures.includes('report') ||
             detectedFeatures.includes('export') ||
             detectedFeatures.includes('security') ||
             detectedFeatures.includes('integration')) {
    category = TASK_CATEGORY.FEATURE
  }

  const priority = mapToTaskPriority(requirement.priority)
  console.log('[analyzeRequirementToTasks] input priority:', requirement.priority, '-> mapped to:', priority)

  const task = {
    title: requirement.title,
    description: requirement.description,
    category: category,
    status: 'TODO',
    priority: priority,
    labels: detectedFeatures.length > 0 ? detectedFeatures : [],
    requirementId: requirement.id
  }
  console.log('[analyzeRequirementToTasks] generated task:', task)
  tasks.push(task)

  return {
    tasks,
    detectedFeatures,
    taskCount: tasks.length,
    suggestions: tasks.map(t => t.title)
  }
}

/**
 * Quick analyze requirement without splitting (for preview)
 * @param {Object} requirement - The requirement to analyze
 * @returns {Object} Quick analysis result
 */
export function quickAnalyzeRequirement(requirement) {
  const text = `${requirement.title} ${requirement.description}`.toLowerCase()
  const detectedFeatures = []

  for (const [feature, pattern] of Object.entries(FEATURE_KEYWORDS)) {
    if (pattern.test(text)) {
      detectedFeatures.push(feature)
    }
  }

  const estimatedTaskCount = Math.max(1, detectedFeatures.length)
  const complexity = estimatedTaskCount > 3 ? 'high' : estimatedTaskCount > 1 ? 'medium' : 'low'

  return {
    detectedFeatures,
    estimatedTaskCount,
    complexity,
    category: detectCategory(text)
  }
}
