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
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V10l7-5 7 5v11"/><path d="M9 21v-7h6v7"/></svg>`,
    description: '负责系统架构设计和技术选型',
    skills: ['系统设计', '技术选型', '架构评估', '微服务设计']
  },
  [AGENT_ROLES.TECH_LEAD]: {
    name: '技术负责人',
    nameEn: 'Tech Lead',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20"/><path d="M5 20V8l7 3 7-3v12"/></svg>`,
    description: '负责技术决策和团队协调',
    skills: ['技术决策', '代码审查', '团队协调', '技术方案设计']
  },
  [AGENT_ROLES.BACKEND_DEV]: {
    name: '后端开发',
    nameEn: 'Backend Developer',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/><circle cx="7" cy="7" r="0.6" fill="currentColor"/><circle cx="7" cy="17" r="0.6" fill="currentColor"/></svg>`,
    description: '负责后端服务和 API 开发',
    skills: ['Java', 'Spring Boot', 'RESTful API', '数据库设计']
  },
  [AGENT_ROLES.FRONTEND_DEV]: {
    name: '前端开发',
    nameEn: 'Frontend Developer',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
    description: '负责用户界面和交互开发',
    skills: ['Vue.js', 'React', 'TypeScript', 'CSS/SCSS']
  },
  [AGENT_ROLES.FULLSTACK_DEV]: {
    name: '全栈开发',
    nameEn: 'Fullstack Developer',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 3 7.5l9 4.5 9-4.5L12 3z"/><path d="M3 16.5 12 21l9-4.5"/><path d="M3 12l9 4.5 9-4.5"/></svg>`,
    description: '负责前后端全栈开发',
    skills: ['前后端开发', '数据库设计', 'API 集成', 'DevOps']
  },
  [AGENT_ROLES.QA_ENGINEER]: {
    name: '测试工程师',
    nameEn: 'QA Engineer',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>`,
    description: '负责质量保证和测试',
    skills: ['单元测试', '集成测试', '自动化测试', '性能测试']
  },
  [AGENT_ROLES.DBA]: {
    name: '数据库管理员',
    nameEn: 'DBA',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="8" ry="2.5"/><path d="M20 12c0 1.4-3.6 2.5-8 2.5S4 13.4 4 12"/><path d="M4 5v14c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5V5"/></svg>`,
    description: '负责数据库设计和优化',
    skills: ['SQL 优化', '数据库设计', '数据迁移', '性能调优']
  },
  [AGENT_ROLES.DEVOPS]: {
    name: '运维工程师',
    nameEn: 'DevOps Engineer',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5C2 14 2 10 4.5 7.5c2-2 5-2 7-1l-2.5 2.5L11 11l3-3-2-2c2-1 5-1 7 1 2.5 2.5 2.5 6.5 0 9-2 2-5 2-7 1l2.5-2.5L13 12l-3 3 2 2c-2 1-5 1-7-1z"/></svg>`,
    description: '负责部署和运维自动化',
    skills: ['CI/CD', 'Docker', 'Kubernetes', '云原生']
  },
  [AGENT_ROLES.PRODUCT_MANAGER]: {
    name: '产品经理',
    nameEn: 'Product Manager',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="1.5"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="13" y2="16"/></svg>`,
    description: '负责产品规划和需求管理',
    skills: ['需求分析', '原型设计', '用户研究', '产品规划']
  },
  [AGENT_ROLES.DESIGNER]: {
    name: '设计师',
    nameEn: 'Designer',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="2"/><path d="M16.5 9.5a4 4 0 0 1 0 5.66L12 19.66 7.34 15a4 4 0 1 1 5.66-5.66"/></svg>`,
    description: '负责 UI/UX 设计',
    skills: ['UI 设计', 'UX 设计', '交互设计', '视觉设计']
  },
  [AGENT_ROLES.SECURITY]: {
    name: '安全工程师',
    nameEn: 'Security Engineer',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-3.5 7-9V5l-7-2-7 2v7c0 5.5 7 9 7 9z"/></svg>`,
    description: '负责安全审计和防护',
    skills: ['安全审计', '渗透测试', '代码审计', '安全加固']
  },
  [AGENT_ROLES.DATA_ENGINEER]: {
    name: '数据工程师',
    nameEn: 'Data Engineer',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="20" x2="6" y2="14"/><line x1="12" y1="20" x2="12" y2="6"/><line x1="18" y1="20" x2="18" y2="10"/></svg>`,
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
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>`,
    description: '',
    skills: []
  }
}
