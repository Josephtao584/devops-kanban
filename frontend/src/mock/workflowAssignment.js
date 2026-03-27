/**
 * Task Category Constants
 */
export const TaskCategory = {
  FEATURE: 'FEATURE',           // 新功能开发
  BUG_FIX: 'BUG_FIX',           // Bug修复
  REFACTORING: 'REFACTORING',   // 重构
  DOCUMENTATION: 'DOCUMENTATION', // 文档
  TESTING: 'TESTING',           // 测试
  DESIGN: 'DESIGN'              // 设计
}

/**
 * Category labels for i18n
 */
export const CategoryLabels = {
  FEATURE: { zh: '新功能', en: 'Feature' },
  BUG_FIX: { zh: 'Bug修复', en: 'Bug Fix' },
  REFACTORING: { zh: '重构', en: 'Refactoring' },
  DOCUMENTATION: { zh: '文档', en: 'Documentation' },
  TESTING: { zh: '测试', en: 'Testing' },
  DESIGN: { zh: '设计', en: 'Design' }
}

/**
 * Agent type mapping
 */
export const AgentTypeMapping = {
  CLAUDE: { color: '#8B5CF6', icon: '🤖', name: 'Claude' },
  CODEX: { color: '#10B981', icon: '💻', name: 'Codex' },
  CURSOR: { color: '#F59E0B', icon: '✨', name: 'Cursor' },
  GEMINI: { color: '#3B82F6', icon: '🔮', name: 'Gemini' }
}

/**
 * Workflow Assignment Rules
 * Defines how tasks are assigned to workflow stages and agents
 */
export const ASSIGNMENT_RULES = {
  FEATURE: {
    preferredStage: 'development',
    preferredAgentType: 'CODEX',
    role: '开发工程师',
    description: 'New feature development task'
  },
  BUG_FIX: {
    preferredStage: 'testing',
    preferredAgentType: 'CLAUDE',
    role: '测试工程师',
    description: 'Bug fix and debugging task'
  },
  REFACTORING: {
    preferredStage: 'development',
    preferredAgentType: 'CODEX',
    role: '开发工程师',
    description: 'Code refactoring task'
  },
  DOCUMENTATION: {
    preferredStage: 'design',
    preferredAgentType: 'CLAUDE',
    role: '文档工程师',
    description: 'Documentation task'
  },
  TESTING: {
    preferredStage: 'testing',
    preferredAgentType: 'CLAUDE',
    role: '测试工程师',
    description: 'Testing task'
  },
  DESIGN: {
    preferredStage: 'design',
    preferredAgentType: 'CURSOR',
    role: '设计师',
    description: 'UI/UX design task'
  }
}

export const CategoryWorkflowTemplateMapping = {
  FEATURE: 'feature-v1',
  BUG_FIX: 'bugfix-v1',
  REFACTORING: 'refactoring-v1',
  DOCUMENTATION: 'documentation-v1',
  TESTING: 'testing-v1',
  DESIGN: 'design-v1'
}

/**
 * Keywords for category detection
 */
const CategoryKeywords = {
  FEATURE: ['feature', 'add', 'implement', 'create', 'new', '功能', '新增', '实现', '添加', '开发'],
  BUG_FIX: ['bug', 'fix', 'error', 'issue', 'crash', '修复', '错误', '问题', '缺陷', '异常'],
  REFACTORING: ['refactor', 'optimize', 'improve', 'clean', '重构', '优化', '改进', '整理'],
  DOCUMENTATION: ['doc', 'readme', 'document', 'comment', '文档', '说明', '注释', 'readme'],
  TESTING: ['test', 'unit', 'e2e', 'coverage', '测试', '单元测试', '集成测试'],
  DESIGN: ['design', 'ui', 'ux', 'style', 'layout', '设计', '界面', '样式', '布局']
}

/**
 * Analyze task content to determine category
 * @param {string} title - Task title
 * @param {string} description - Task description
 * @returns {string} Category key
 */
export function analyzeTaskCategory(title = '', description = '') {
  const text = `${title} ${description}`.toLowerCase()

  // Score each category based on keyword matches
  const scores = {}

  for (const [category, keywords] of Object.entries(CategoryKeywords)) {
    scores[category] = 0
    for (const keyword of keywords) {
      const regex = new RegExp(keyword, 'gi')
      const matches = text.match(regex)
      if (matches) {
        scores[category] += matches.length
      }
    }
  }

  // Find category with highest score
  let maxScore = 0
  let bestCategory = 'FEATURE' // Default to FEATURE

  for (const [category, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score
      bestCategory = category
    }
  }

  return bestCategory
}

/**
 * Get assignment rule for a category
 * @param {string} category - Task category
 * @returns {Object} Assignment rule
 */
export function getAssignmentRule(category) {
  return ASSIGNMENT_RULES[category] || ASSIGNMENT_RULES.FEATURE
}

export function getRecommendedWorkflowTemplateId(category) {
  return CategoryWorkflowTemplateMapping[category] || CategoryWorkflowTemplateMapping.FEATURE
}

/**
 * Get category label
 * @param {string} category - Task category
 * @param {string} lang - Language code ('zh' or 'en')
 * @returns {string} Category label
 */
export function getCategoryLabel(category, lang = 'zh') {
  const label = CategoryLabels[category]
  return label ? label[lang] : category
}

/**
 * Get all categories as options for select
 * @param {string} lang - Language code
 * @returns {Array} Array of {value, label} objects
 */
export function getCategoryOptions(lang = 'zh') {
  return Object.keys(TaskCategory).map(key => ({
    value: TaskCategory[key],
    label: getCategoryLabel(TaskCategory[key], lang)
  }))
}

/**
 * Find suitable stage in workflow based on preferred stage type
 * @param {Object} workflow - Workflow object
 * @param {string} preferredStage - Preferred stage identifier
 * @returns {Object|null} Stage object or null
 */
export function findSuitableStage(workflow, preferredStage) {
  if (!workflow?.stages) return null

  // First try to find exact match
  const exactMatch = workflow.stages.find(s =>
    s.name.toLowerCase().includes(preferredStage.toLowerCase())
  )
  if (exactMatch) return exactMatch

  // Try to find by stage order (prefer middle stages for new tasks)
  const stageOrder = {
    'design': 1,
    'development': 2,
    'testing': 3,
    'deployment': 4
  }

  const targetOrder = stageOrder[preferredStage] || 2

  // Find stage with closest order
  return workflow.stages.reduce((closest, stage) => {
    const stageOrderValue = Object.entries(stageOrder).find(([key]) =>
      stage.name.toLowerCase().includes(key)
    )?.[1] || 2

    if (!closest) return stage

    const currentDiff = Math.abs((stageOrder[closest.name.toLowerCase()] || 2) - targetOrder)
    const newDiff = Math.abs(stageOrderValue - targetOrder)

    return newDiff < currentDiff ? stage : closest
  }, null)
}

/**
 * Generate unique node ID
 * @returns {number} Unique node ID
 */
export function generateNodeId() {
  return Date.now() + Math.floor(Math.random() * 1000)
}

/**
 * Create workflow node data for a task
 * @param {Object} task - Task object
 * @param {string} category - Task category
 * @param {Object} rule - Assignment rule
 * @returns {Object} Node data
 */
export function createNodeForTask(task, category, rule) {
  const agentInfo = AgentTypeMapping[rule.preferredAgentType] || AgentTypeMapping.CODEX

  return {
    id: generateNodeId(),
    name: task.title,
    role: rule.role,
    agentType: rule.preferredAgentType,
    agentName: `${agentInfo.name} ${rule.role}`,
    status: 'PENDING',
    task: {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status
    },
    messages: []
  }
}
