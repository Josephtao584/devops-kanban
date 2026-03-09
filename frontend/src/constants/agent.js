/**
 * Agent role constants
 * These roles correspond to workflow node roles
 */
export const AGENT_ROLES = {
  ARCHITECT: 'ARCHITECT',           // 架构师
  TECH_LEAD: 'TECH_LEAD',           // 技术负责人
  BACKEND_DEV: 'BACKEND_DEV',       // 后端开发
  FRONTEND_DEV: 'FRONTEND_DEV',     // 前端开发
  FULLSTACK_DEV: 'FULLSTACK_DEV',   // 全栈开发
  QA_ENGINEER: 'QA_ENGINEER',       // 测试工程师
  DBA: 'DBA',                       // 数据库管理员
  DEVOPS: 'DEVOPS',                 // 运维工程师
  PRODUCT_MANAGER: 'PRODUCT_MANAGER', // 产品经理
  DESIGNER: 'DESIGNER',             // 设计师
  SECURITY: 'SECURITY',             // 安全工程师
  DATA_ENGINEER: 'DATA_ENGINEER'    // 数据工程师
}

/**
 * Role display configuration
 */
export const ROLE_CONFIG = {
  [AGENT_ROLES.ARCHITECT]: {
    name: '架构师',
    nameEn: 'Architect',
    icon: '🏗️',
    color: '#8B5CF6',
    description: '负责系统架构设计和技术选型'
  },
  [AGENT_ROLES.TECH_LEAD]: {
    name: '技术负责人',
    nameEn: 'Tech Lead',
    icon: '👨‍💼',
    color: '#F59E0B',
    description: '负责技术决策和团队协调'
  },
  [AGENT_ROLES.BACKEND_DEV]: {
    name: '后端开发',
    nameEn: 'Backend Developer',
    icon: '⚙️',
    color: '#10B981',
    description: '负责后端服务和API开发'
  },
  [AGENT_ROLES.FRONTEND_DEV]: {
    name: '前端开发',
    nameEn: 'Frontend Developer',
    icon: '🎨',
    color: '#3B82F6',
    description: '负责用户界面和交互开发'
  },
  [AGENT_ROLES.FULLSTACK_DEV]: {
    name: '全栈开发',
    nameEn: 'Fullstack Developer',
    icon: '🔧',
    color: '#6366F1',
    description: '负责前后端全栈开发'
  },
  [AGENT_ROLES.QA_ENGINEER]: {
    name: '测试工程师',
    nameEn: 'QA Engineer',
    icon: '🔍',
    color: '#EC4899',
    description: '负责质量保证和测试'
  },
  [AGENT_ROLES.DBA]: {
    name: '数据库管理员',
    nameEn: 'DBA',
    icon: '🗄️',
    color: '#14B8A6',
    description: '负责数据库设计和优化'
  },
  [AGENT_ROLES.DEVOPS]: {
    name: '运维工程师',
    nameEn: 'DevOps Engineer',
    icon: '🚀',
    color: '#F97316',
    description: '负责部署和运维自动化'
  },
  [AGENT_ROLES.PRODUCT_MANAGER]: {
    name: '产品经理',
    nameEn: 'Product Manager',
    icon: '📋',
    color: '#A855F7',
    description: '负责产品规划和需求管理'
  },
  [AGENT_ROLES.DESIGNER]: {
    name: '设计师',
    nameEn: 'Designer',
    icon: '✏️',
    color: '#D946EF',
    description: '负责UI/UX设计'
  },
  [AGENT_ROLES.SECURITY]: {
    name: '安全工程师',
    nameEn: 'Security Engineer',
    icon: '🔒',
    color: '#EF4444',
    description: '负责安全审计和防护'
  },
  [AGENT_ROLES.DATA_ENGINEER]: {
    name: '数据工程师',
    nameEn: 'Data Engineer',
    icon: '📊',
    color: '#22C55E',
    description: '负责数据处理和分析'
  }
}

/**
 * Get role display info
 * @param {string} role - Role key
 * @returns {Object} Role configuration
 */
export function getRoleConfig(role) {
  return ROLE_CONFIG[role] || {
    name: role,
    nameEn: role,
    icon: '🤖',
    color: '#6B7280',
    description: ''
  }
}

/**
 * Get all roles as options for select
 * @returns {Array} Array of { value, label } objects
 */
export function getRoleOptions() {
  return Object.entries(ROLE_CONFIG).map(([key, config]) => ({
    value: key,
    label: `${config.icon} ${config.name}`,
    labelEn: `${config.icon} ${config.nameEn}`
  }))
}