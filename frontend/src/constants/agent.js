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
 * Icons use SVG paths for a professional appearance
 */
export const ROLE_CONFIG = {
  [AGENT_ROLES.ARCHITECT]: {
    name: '架构师',
    nameEn: 'Architect',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6m10-11h-6m-6 0H1m15.5-6.5l-4.25 4.25m-4.5 4.5L4.5 19.5m15 0l-4.25-4.25m-4.5-4.5L6.5 4.5"/></svg>',
    gradient: 'linear-gradient(135deg, #6EDBDD, #25C6C9)',
    description: '负责系统架构设计和技术选型',
    skills: ['系统设计', '技术选型', '架构评估', '微服务设计']
  },
  [AGENT_ROLES.TECH_LEAD]: {
    name: '技术负责人',
    nameEn: 'Tech Lead',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
    gradient: 'linear-gradient(135deg, #F4D289, #EAB445)',
    description: '负责技术决策和团队协调',
    skills: ['技术决策', '代码审查', '团队协调', '技术方案设计']
  },
  [AGENT_ROLES.BACKEND_DEV]: {
    name: '后端开发',
    nameEn: 'Backend Developer',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6" y2="6"/><line x1="6" y1="18" x2="6" y2="18"/></svg>',
    gradient: 'linear-gradient(135deg, #34d399, #10b981)',
    description: '负责后端服务和 API 开发',
    skills: ['Java', 'Spring Boot', 'RESTful API', '数据库设计']
  },
  [AGENT_ROLES.FRONTEND_DEV]: {
    name: '前端开发',
    nameEn: 'Frontend Developer',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    gradient: 'linear-gradient(135deg, #60a5fa, #3b82f6)',
    description: '负责用户界面和交互开发',
    skills: ['Vue.js', 'React', 'TypeScript', 'CSS/SCSS']
  },
  [AGENT_ROLES.FULLSTACK_DEV]: {
    name: '全栈开发',
    nameEn: 'Fullstack Developer',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7h6V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="8" y1="22" x2="8" y2="12"/><line x1="16" y1="22" x2="16" y2="12"/></svg>',
    gradient: 'linear-gradient(135deg, #818cf8, #6366f1)',
    description: '负责前后端全栈开发',
    skills: ['前后端开发', '数据库设计', 'API 集成', 'DevOps']
  },
  [AGENT_ROLES.QA_ENGINEER]: {
    name: '测试工程师',
    nameEn: 'QA Engineer',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>',
    gradient: 'linear-gradient(135deg, #f472b6, #ec4899)',
    description: '负责质量保证和测试',
    skills: ['单元测试', '集成测试', '自动化测试', '性能测试']
  },
  [AGENT_ROLES.DBA]: {
    name: '数据库管理员',
    nameEn: 'DBA',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
    gradient: 'linear-gradient(135deg, #2dd4bf, #14b8a6)',
    description: '负责数据库设计和优化',
    skills: ['SQL 优化', '数据库设计', '数据迁移', '性能调优']
  },
  [AGENT_ROLES.DEVOPS]: {
    name: '运维工程师',
    nameEn: 'DevOps Engineer',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    gradient: 'linear-gradient(135deg, #fb923c, #f97316)',
    description: '负责部署和运维自动化',
    skills: ['CI/CD', 'Docker', 'Kubernetes', '云原生']
  },
  [AGENT_ROLES.PRODUCT_MANAGER]: {
    name: '产品经理',
    nameEn: 'Product Manager',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
    gradient: 'linear-gradient(135deg, #c084fc, #a855f7)',
    description: '负责产品规划和需求管理',
    skills: ['需求分析', '原型设计', '用户研究', '产品规划']
  },
  [AGENT_ROLES.DESIGNER]: {
    name: '设计师',
    nameEn: 'Designer',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>',
    gradient: 'linear-gradient(135deg, #e879f9, #d946ef)',
    description: '负责 UI/UX 设计',
    skills: ['UI 设计', 'UX 设计', '交互设计', '视觉设计']
  },
  [AGENT_ROLES.SECURITY]: {
    name: '安全工程师',
    nameEn: 'Security Engineer',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><circle cx="12" cy="10" r="3"/></svg>',
    gradient: 'linear-gradient(135deg, #f87171, #ef4444)',
    description: '负责安全审计和防护',
    skills: ['安全审计', '渗透测试', '代码审计', '安全加固']
  },
  [AGENT_ROLES.DATA_ENGINEER]: {
    name: '数据工程师',
    nameEn: 'Data Engineer',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    gradient: 'linear-gradient(135deg, #4ade80, #22c55e)',
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
