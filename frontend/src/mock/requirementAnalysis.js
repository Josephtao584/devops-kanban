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
    /实现|添加|开发|创建|增加|新增|支持|feature|implement|add|create|develop|support/i
  ],
  [TASK_CATEGORY.BUG_FIX]: [
    /修复|解决|bug|fix|issue|问题|错误|异常|崩溃|crash|error|exception/i
  ],
  [TASK_CATEGORY.DESIGN]: [
    /设计|界面|UI|页面|样式|布局|design|ui|style|layout|前端展示/i
  ],
  [TASK_CATEGORY.TESTING]: [
    /测试|单元测试|集成测试|test|testing|unit test|integration/i
  ],
  [TASK_CATEGORY.DOCUMENTATION]: [
    /文档|说明|readme|doc|documentation|指南|手册/i
  ],
  [TASK_CATEGORY.REFACTORING]: [
    /重构|优化|改进|refactor|optimize|improve|清理/i
  ]
}

/**
 * Feature-specific keywords for task splitting
 */
const FEATURE_KEYWORDS = {
  authentication: /登录|认证|auth|login|oauth|sso|token|密码|password/i,
  ui: /界面|页面|ui|前端|展示|display|page|view/i,
  api: /api|接口|rest|graphql|endpoint/i,
  database: /数据库|存储|database|db|sql|持久化/i,
  notification: /通知|消息|推送|notification|message|alert/i,
  report: /报表|统计|报告|report|analytics|dashboard/i,
  export: /导出|export|excel|pdf|csv/i,
  performance: /性能|优化|缓存|performance|cache|speed/i,
  security: /安全|加密|权限|security|encrypt|permission/i,
  integration: /集成|对接|接入|integration|connect|sync/i
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
 * Analyze requirement and split into tasks
 * @param {Object} requirement - The requirement to analyze
 * @returns {Object} Analysis result with task templates
 */
export function analyzeRequirementToTasks(requirement) {
  const tasks = []
  const text = `${requirement.title} ${requirement.description}`.toLowerCase()
  const detectedFeatures = []

  // Detect features from keywords
  for (const [feature, pattern] of Object.entries(FEATURE_KEYWORDS)) {
    if (pattern.test(text)) {
      detectedFeatures.push(feature)
    }
  }

  // Generate tasks based on detected features
  if (detectedFeatures.includes('authentication')) {
    tasks.push({
      title: '实现用户登录功能',
      description: '实现基础的用户名密码登录，支持记住我功能',
      category: TASK_CATEGORY.FEATURE,
      status: 'TODO',
      priority: mapToTaskPriority(requirement.priority),
      labels: ['auth', 'login'],
      requirementId: requirement.id
    })
    if (/oauth|第三方|github|google/i.test(text)) {
      tasks.push({
        title: '集成OAuth第三方登录',
        description: '集成GitHub和Google的OAuth2.0登录，支持第三方账号授权',
        category: TASK_CATEGORY.FEATURE,
        status: 'TODO',
        priority: mapToTaskPriority(requirement.priority),
        labels: ['auth', 'oauth', 'integration'],
        requirementId: requirement.id
      })
    }
  }

  if (detectedFeatures.includes('ui')) {
    tasks.push({
      title: '开发用户界面',
      description: '根据需求设计和开发用户界面，确保响应式和良好的用户体验',
      category: TASK_CATEGORY.DESIGN,
      status: 'TODO',
      priority: mapToTaskPriority(requirement.priority),
      labels: ['ui', 'frontend'],
      requirementId: requirement.id
    })
  }

  if (detectedFeatures.includes('api')) {
    tasks.push({
      title: '设计和实现API接口',
      description: '设计RESTful API接口，实现后端业务逻辑',
      category: TASK_CATEGORY.FEATURE,
      status: 'TODO',
      priority: mapToTaskPriority(requirement.priority),
      labels: ['api', 'backend'],
      requirementId: requirement.id
    })
  }

  if (detectedFeatures.includes('database')) {
    tasks.push({
      title: '数据库设计与实现',
      description: '设计数据模型，创建数据库表结构，实现数据访问层',
      category: TASK_CATEGORY.FEATURE,
      status: 'TODO',
      priority: mapToTaskPriority(requirement.priority),
      labels: ['database', 'backend'],
      requirementId: requirement.id
    })
  }

  if (detectedFeatures.includes('notification')) {
    tasks.push({
      title: '实现消息通知功能',
      description: '实现站内消息通知功能，支持邮件和推送通知',
      category: TASK_CATEGORY.FEATURE,
      status: 'TODO',
      priority: mapToTaskPriority(requirement.priority),
      labels: ['notification', 'integration'],
      requirementId: requirement.id
    })
  }

  if (detectedFeatures.includes('report')) {
    tasks.push({
      title: '开发数据报表模块',
      description: '实现数据统计和报表生成功能',
      category: TASK_CATEGORY.FEATURE,
      status: 'TODO',
      priority: mapToTaskPriority(requirement.priority),
      labels: ['report', 'analytics'],
      requirementId: requirement.id
    })
  }

  if (detectedFeatures.includes('export')) {
    tasks.push({
      title: '实现数据导出功能',
      description: '支持导出数据为Excel、PDF等格式',
      category: TASK_CATEGORY.FEATURE,
      status: 'TODO',
      priority: mapToTaskPriority(requirement.priority),
      labels: ['export'],
      requirementId: requirement.id
    })
  }

  if (detectedFeatures.includes('security')) {
    tasks.push({
      title: '实现安全机制',
      description: '实现数据加密、权限控制等安全相关功能',
      category: TASK_CATEGORY.FEATURE,
      status: 'TODO',
      priority: mapToTaskPriority(requirement.priority),
      labels: ['security'],
      requirementId: requirement.id
    })
  }

  if (detectedFeatures.includes('integration')) {
    tasks.push({
      title: '系统集成与对接',
      description: '与第三方系统进行集成，实现数据同步和功能对接',
      category: TASK_CATEGORY.FEATURE,
      status: 'TODO',
      priority: mapToTaskPriority(requirement.priority),
      labels: ['integration'],
      requirementId: requirement.id
    })
  }

  // If no specific tasks were generated, create a default task
  if (tasks.length === 0) {
    tasks.push({
      title: requirement.title,
      description: requirement.description,
      category: detectCategory(text),
      status: 'TODO',
      priority: mapToTaskPriority(requirement.priority),
      labels: [],
      requirementId: requirement.id
    })
  }

  // Always add testing task if feature tasks exist
  if (tasks.length > 1 || detectedFeatures.length > 0) {
    tasks.push({
      title: '编写测试用例',
      description: '为新功能编写单元测试和集成测试',
      category: TASK_CATEGORY.TESTING,
      status: 'TODO',
      priority: 'MEDIUM',
      labels: ['testing'],
      requirementId: requirement.id
    })
  }

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
