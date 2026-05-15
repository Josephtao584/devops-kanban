/**
 * Agent role constants
 * These roles correspond to workflow node roles
 */
const AGENT_ROLES = {
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
 * Icons use SVG paths for a professional appearance
 */
export const ROLE_CONFIG = {
  [AGENT_ROLES.ARCHITECT]: {
    name: '架构师',
    nameEn: 'Architect',
    icon: '🏛️',
    gradient: 'linear-gradient(135deg, #6EDBDD, #25C6C9)',
    glow: '0 0 20px rgba(37, 198, 201, 0.4)',
    description: '负责系统架构设计和技术选型',
    skills: ['系统设计', '技术选型', '架构评估', '微服务设计']
  },
  [AGENT_ROLES.TECH_LEAD]: {
    name: '技术负责人',
    nameEn: 'Tech Lead',
    icon: '👑',
    gradient: 'linear-gradient(135deg, #F4D289, #EAB445)',
    glow: '0 0 20px rgba(234, 180, 69, 0.4)',
    description: '负责技术决策和团队协调',
    skills: ['技术决策', '代码审查', '团队协调', '技术方案设计']
  },
  [AGENT_ROLES.BACKEND_DEV]: {
    name: '后端开发',
    nameEn: 'Backend Developer',
    icon: '⚡',
    gradient: 'linear-gradient(135deg, #34d399, #10b981)',
    glow: '0 0 20px rgba(16, 185, 129, 0.4)',
    description: '负责后端服务和 API 开发',
    skills: ['Java', 'Spring Boot', 'RESTful API', '数据库设计']
  },
  [AGENT_ROLES.FRONTEND_DEV]: {
    name: '前端开发',
    nameEn: 'Frontend Developer',
    icon: '🎨',
    gradient: 'linear-gradient(135deg, #60a5fa, #3b82f6)',
    glow: '0 0 20px rgba(59, 130, 246, 0.4)',
    description: '负责用户界面和交互开发',
    skills: ['Vue.js', 'React', 'TypeScript', 'CSS/SCSS']
  },
  [AGENT_ROLES.FULLSTACK_DEV]: {
    name: '全栈开发',
    nameEn: 'Fullstack Developer',
    icon: '🔥',
    gradient: 'linear-gradient(135deg, #55d2d5, #25C6C9)',
    glow: '0 0 20px rgba(37, 198, 201, 0.4)',
    description: '负责前后端全栈开发',
    skills: ['前后端开发', '数据库设计', 'API 集成', 'DevOps']
  },
  [AGENT_ROLES.QA_ENGINEER]: {
    name: '测试工程师',
    nameEn: 'QA Engineer',
    icon: '🛡️',
    gradient: 'linear-gradient(135deg, #f472b6, #ec4899)',
    glow: '0 0 20px rgba(236, 72, 153, 0.4)',
    description: '负责质量保证和测试',
    skills: ['单元测试', '集成测试', '自动化测试', '性能测试']
  },
  [AGENT_ROLES.DBA]: {
    name: '数据库管理员',
    nameEn: 'DBA',
    icon: '🗄️',
    gradient: 'linear-gradient(135deg, #2dd4bf, #14b8a6)',
    glow: '0 0 20px rgba(20, 184, 166, 0.4)',
    description: '负责数据库设计和优化',
    skills: ['SQL 优化', '数据库设计', '数据迁移', '性能调优']
  },
  [AGENT_ROLES.DEVOPS]: {
    name: '运维工程师',
    nameEn: 'DevOps Engineer',
    icon: '🚀',
    gradient: 'linear-gradient(135deg, #fb923c, #f97316)',
    glow: '0 0 20px rgba(249, 115, 22, 0.4)',
    description: '负责部署和运维自动化',
    skills: ['CI/CD', 'Docker', 'Kubernetes', '云原生']
  },
  [AGENT_ROLES.PRODUCT_MANAGER]: {
    name: '产品经理',
    nameEn: 'Product Manager',
    icon: '📋',
    gradient: 'linear-gradient(135deg, #c084fc, #a855f7)',
    glow: '0 0 20px rgba(168, 85, 247, 0.4)',
    description: '负责产品规划和需求管理',
    skills: ['需求分析', '原型设计', '用户研究', '产品规划']
  },
  [AGENT_ROLES.DESIGNER]: {
    name: '设计师',
    nameEn: 'Designer',
    icon: '✨',
    gradient: 'linear-gradient(135deg, #e879f9, #d946ef)',
    glow: '0 0 20px rgba(217, 70, 239, 0.4)',
    description: '负责 UI/UX 设计',
    skills: ['UI 设计', 'UX 设计', '交互设计', '视觉设计']
  },
  [AGENT_ROLES.SECURITY]: {
    name: '安全工程师',
    nameEn: 'Security Engineer',
    icon: '🔐',
    gradient: 'linear-gradient(135deg, #f87171, #ef4444)',
    glow: '0 0 20px rgba(239, 68, 68, 0.4)',
    description: '负责安全审计和防护',
    skills: ['安全审计', '渗透测试', '代码审计', '安全加固']
  },
  [AGENT_ROLES.DATA_ENGINEER]: {
    name: '数据工程师',
    nameEn: 'Data Engineer',
    icon: '📊',
    gradient: 'linear-gradient(135deg, #4ade80, #22c55e)',
    glow: '0 0 20px rgba(34, 197, 94, 0.4)',
    description: '负责数据处理和分析',
    skills: ['数据处理', 'ETL', '数据分析', '大数据技术']
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
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
    gradient: 'linear-gradient(135deg, #9ca3af, #6b7280)',
    description: '',
    skills: []
  }
}
