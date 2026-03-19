// Mock data for demo

export const mockProjects = [
  {
    id: 1,
    name: 'DevOps Kanban',
    description: 'DevOps看板系统，支持AI Agent执行任务',
    repoUrl: 'https://github.com/example/devops-kanban',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-03-09T14:30:00Z'
  },
  {
    id: 2,
    name: 'API Gateway',
    description: '微服务API网关项目',
    repoUrl: 'https://github.com/example/api-gateway',
    createdAt: '2024-02-20T09:00:00Z',
    updatedAt: '2024-03-08T16:00:00Z'
  }
]

export const mockAgents = [
  {
    id: 1,
    name: '大翔',
    type: 'CLAUDE',
    role: 'ARCHITECT',
    description: '负责系统架构设计和技术选型',
    config: {
      model: 'claude-opus-4-6',
      maxTokens: 8192
    },
    enabled: true,
    createdAt: '2024-01-15T10:00:00Z'
  },
  {
    id: 2,
    name: '老袁',
    type: 'CLAUDE',
    role: 'TECH_LEAD',
    description: '负责技术决策和团队协调',
    config: {
      model: 'claude-sonnet-4-6',
      maxTokens: 4096
    },
    enabled: true,
    createdAt: '2024-01-15T10:00:00Z'
  },
  {
    id: 3,
    name: '阿哲',
    type: 'CODEX',
    role: 'BACKEND_DEV',
    description: '负责后端服务和API开发',
    config: {
      model: 'gpt-4',
      maxTokens: 4096
    },
    enabled: true,
    createdAt: '2024-01-16T09:00:00Z'
  },
  {
    id: 4,
    name: '小慧',
    type: 'CURSOR',
    role: 'FRONTEND_DEV',
    description: '负责用户界面和交互开发',
    config: {
      model: 'cursor-pro',
      maxTokens: 4096
    },
    enabled: true,
    createdAt: '2024-01-16T10:00:00Z'
  },
  {
    id: 5,
    name: '老王',
    type: 'GEMINI',
    role: 'DBA',
    description: '负责数据库设计和优化',
    config: {
      model: 'gemini-pro',
      maxTokens: 4096
    },
    enabled: true,
    createdAt: '2024-01-17T09:00:00Z'
  },
  {
    id: 6,
    name: '小娴',
    type: 'CLAUDE',
    role: 'QA_ENGINEER',
    description: '负责质量保证和测试',
    config: {
      model: 'claude-sonnet-4-6',
      maxTokens: 4096
    },
    enabled: true,
    createdAt: '2024-01-17T10:00:00Z'
  },
  {
    id: 7,
    name: '阿文',
    type: 'CLAUDE',
    role: 'PRODUCT_MANAGER',
    description: '负责产品规划和需求管理',
    config: {
      model: 'claude-sonnet-4-6',
      maxTokens: 4096
    },
    enabled: true,
    createdAt: '2024-01-18T09:00:00Z'
  },
  {
    id: 8,
    name: '大青',
    type: 'CODEX',
    role: 'DEVOPS',
    description: '负责部署和运维自动化',
    config: {
      model: 'gpt-4',
      maxTokens: 4096
    },
    enabled: false,
    createdAt: '2024-01-18T10:00:00Z'
  }
]

export const mockTasks = [
  {
    id: 1,
    projectId: 1,
    title: '实现用户登录功能',
    description: '添加OAuth2.0登录支持，支持GitHub和Google登录',
    status: 'DONE',
    priority: 'HIGH',
    assignee: '张三',
    labels: ['feature', 'auth'],
    createdAt: '2024-03-01T09:00:00Z',
    updatedAt: '2024-03-05T15:00:00Z'
  },
  {
    id: 2,
    projectId: 1,
    title: '优化数据库查询性能',
    description: '分析慢查询日志，添加必要的索引，优化复杂SQL',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    assignee: '李四',
    labels: ['performance', 'database'],
    createdAt: '2024-03-03T10:00:00Z',
    updatedAt: '2024-03-09T11:00:00Z'
  },
  {
    id: 3,
    projectId: 1,
    title: '添加任务导出功能',
    description: '支持导出任务列表为Excel和PDF格式',
    status: 'TODO',
    priority: 'MEDIUM',
    assignee: null,
    labels: ['feature'],
    createdAt: '2024-03-05T14:00:00Z',
    updatedAt: '2024-03-05T14:00:00Z'
  },
  {
    id: 4,
    projectId: 1,
    title: '修复分页组件Bug',
    description: '当数据为空时，分页组件显示异常',
    status: 'IN_PROGRESS',
    priority: 'LOW',
    assignee: '王五',
    labels: ['bug', 'frontend'],
    createdAt: '2024-03-06T09:00:00Z',
    updatedAt: '2024-03-09T10:00:00Z'
  },
  {
    id: 5,
    projectId: 1,
    title: '集成消息通知服务',
    description: '接入企业微信和钉钉机器人通知',
    status: 'TODO',
    priority: 'MEDIUM',
    assignee: '张三',
    labels: ['feature', 'integration'],
    createdAt: '2024-03-07T11:00:00Z',
    updatedAt: '2024-03-08T16:00:00Z'
  },
  {
    id: 6,
    projectId: 2,
    title: '实现限流功能',
    description: '基于Redis实现令牌桶限流',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    assignee: '李四',
    labels: ['feature', 'backend'],
    createdAt: '2024-03-02T10:00:00Z',
    updatedAt: '2024-03-09T10:00:00Z'
  },
  {
    id: 7,
    projectId: 2,
    title: '添加API文档',
    description: '集成Swagger/OpenAPI文档',
    status: 'DONE',
    priority: 'MEDIUM',
    assignee: '王五',
    labels: ['docs'],
    createdAt: '2024-02-25T09:00:00Z',
    updatedAt: '2024-03-01T14:00:00Z'
  },
  {
    id: 8,
    projectId: 1,
    title: '优化页面加载速度',
    description: '分析前端性能瓶颈，优化资源加载，减少首屏渲染时间',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    assignee: '张三',
    labels: ['performance', 'frontend'],
    createdAt: '2024-03-08T10:00:00Z',
    updatedAt: '2024-03-09T09:00:00Z'
  }
]

export const mockTaskSources = [
  {
    id: 1,
    projectId: 1,
    name: 'GitHub Issues',
    type: 'github',
    config: {
      repo: 'example/devops-kanban',
      labels: ['bug', 'feature']
    },
    enabled: true
  },
  {
    id: 2,
    projectId: 1,
    name: 'Jira Board',
    type: 'jira',
    config: {
      boardId: 'DEV-123',
      jql: 'project = DEV'
    },
    enabled: false
  }
]

export const mockSessions = [
  {
    id: 'session-1',
    taskId: 2,
    agentId: 1,
    status: 'RUNNING',
    createdAt: '2024-03-09T10:00:00Z',
    output: '正在分析数据库查询...\n发现3个慢查询\n建议添加索引: idx_user_email, idx_task_status'
  },
  {
    id: 'session-2',
    taskId: 5,
    agentId: 2,
    status: 'IDLE',
    createdAt: '2024-03-08T14:00:00Z',
    output: '等待企业微信API密钥配置...'
  }
]

export const mockIterations = [
  {
    id: 1,
    project_id: 1,
    name: 'Sprint 1',
    goal: '完成基础功能开发',
    status: 'DONE',
    startDate: '2024-03-01',
    endDate: '2024-03-14',
    taskCount: 5,
    completedCount: 3,
    createdAt: '2024-03-01T09:00:00Z'
  },
  {
    id: 2,
    project_id: 1,
    name: 'Sprint 2',
    goal: '性能优化与Bug修复',
    status: 'IN_PROGRESS',
    startDate: '2024-03-15',
    endDate: '2024-03-28',
    taskCount: 8,
    completedCount: 2,
    createdAt: '2024-03-15T09:00:00Z'
  },
  {
    id: 3,
    project_id: 1,
    name: 'Sprint 3',
    goal: '新功能规划',
    status: 'PLANNING',
    startDate: '2024-03-29',
    endDate: '2024-04-11',
    taskCount: 0,
    completedCount: 0,
    createdAt: '2024-03-20T09:00:00Z'
  }
]

export const mockExecutions = [
  {
    id: 1,
    taskId: 1,
    agentId: 3,
    status: 'SUCCESS',
    worktreePath: '/tmp/worktrees/task-1-abc123',
    branch: 'feature/login-oauth',
    output: 'OAuth2.0登录功能开发完成。\n\n已实现:\n- GitHub OAuth登录\n- Google OAuth登录\n- 用户信息同步\n- Token刷新机制',
    startedAt: '2024-03-01T09:30:00Z',
    completedAt: '2024-03-01T11:45:00Z',
    taskTitle: '实现用户登录功能',
    taskStatus: 'DONE'
  },
  {
    id: 2,
    taskId: 2,
    agentId: 5,
    status: 'SUCCESS',
    worktreePath: '/tmp/worktrees/task-2-def456',
    branch: 'feature/db-optimization',
    output: '数据库优化完成。\n\n优化内容:\n- 添加了idx_user_email索引\n- 添加了idx_task_status索引\n- 优化了复杂查询SQL\n- 查询性能提升60%',
    startedAt: '2024-03-03T10:00:00Z',
    completedAt: '2024-03-03T14:30:00Z',
    taskTitle: '优化数据库查询性能',
    taskStatus: 'IN_PROGRESS'
  },
  {
    id: 3,
    taskId: 4,
    agentId: 4,
    status: 'RUNNING',
    worktreePath: '/tmp/worktrees/task-4-ghi789',
    branch: 'fix/pagination-bug',
    output: '正在修复分页组件Bug...\n\n进度:\n- 已定位问题原因\n- 正在编写修复代码...',
    startedAt: '2024-03-12T08:00:00Z',
    completedAt: null,
    taskTitle: '修复分页组件Bug',
    taskStatus: 'IN_PROGRESS'
  },
  {
    id: 4,
    taskId: 6,
    agentId: 3,
    status: 'FAILED',
    worktreePath: '/tmp/worktrees/task-6-jkl012',
    branch: 'feature/rate-limiting',
    output: '限流功能实现失败：Redis连接超时\n\n错误详情:\n- 连接redis://localhost:6379超时\n- 请检查Redis服务是否正常运行',
    startedAt: '2024-03-10T14:00:00Z',
    completedAt: '2024-03-10T14:30:00Z',
    taskTitle: '实现限流功能',
    taskStatus: 'IN_PROGRESS'
  },
  {
    id: 5,
    taskId: 7,
    agentId: 1,
    status: 'SUCCESS',
    worktreePath: '/tmp/worktrees/task-7-mno345',
    branch: 'docs/api-documentation',
    output: 'API文档生成完成\n\n已完成:\n- Swagger集成\n- OpenAPI 3.0规范\n- 接口文档在线预览',
    startedAt: '2024-02-25T09:00:00Z',
    completedAt: '2024-02-25T12:00:00Z',
    taskTitle: '添加API文档',
    taskStatus: 'DONE'
  },
  {
    id: 6,
    taskId: 8,
    agentId: 4,
    status: 'PENDING',
    worktreePath: null,
    branch: null,
    output: null,
    startedAt: '2024-03-12T09:00:00Z',
    completedAt: null,
    taskTitle: '优化页面加载速度',
    taskStatus: 'IN_PROGRESS'
  },
  {
    id: 7,
    taskId: 2,
    agentId: 5,
    status: 'CANCELLED',
    worktreePath: '/tmp/worktrees/task-2-pqr678',
    branch: 'feature/db-indexes',
    output: '用户取消执行',
    startedAt: '2024-03-02T15:00:00Z',
    completedAt: '2024-03-02T15:10:00Z',
    taskTitle: '优化数据库查询性能',
    taskStatus: 'IN_PROGRESS'
  },
  {
    id: 8,
    taskId: 3,
    agentId: 2,
    status: 'SUCCESS',
    worktreePath: '/tmp/worktrees/task-3-stu901',
    branch: 'feature/task-export',
    output: '任务导出功能开发完成\n\n支持格式:\n- Excel (.xlsx)\n- PDF\n- CSV',
    startedAt: '2024-03-05T15:00:00Z',
    completedAt: '2024-03-05T18:00:00Z',
    taskTitle: '添加任务导出功能',
    taskStatus: 'TODO'
  }
]

// Helper to generate IDs
let nextTaskId = 100
let nextProjectId = 10
let nextAgentId = 10
let nextSessionId = 10
let nextExecutionId = 100
let nextIterationId = 10

export const generateId = {
  task: () => nextTaskId++,
  project: () => nextProjectId++,
  agent: () => nextAgentId++,
  session: () => `session-${nextSessionId++}`,
  execution: () => nextExecutionId++,
  iteration: () => nextIterationId++
}
