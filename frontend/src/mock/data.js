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
    name: 'Claude Architect',
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
    name: 'Claude Lead',
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
    name: 'Codex Backend',
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
    name: 'Cursor FE',
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
    name: 'Gemini DBA',
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
    name: 'Claude QA',
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
    name: 'Claude PM',
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
    name: 'Codex DevOps',
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
    status: 'TODO',
    priority: 'LOW',
    assignee: '王五',
    labels: ['bug', 'frontend'],
    createdAt: '2024-03-06T09:00:00Z',
    updatedAt: '2024-03-06T09:00:00Z'
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

// Helper to generate IDs
let nextTaskId = 100
let nextProjectId = 10
let nextAgentId = 10
let nextSessionId = 10

export const generateId = {
  task: () => nextTaskId++,
  project: () => nextProjectId++,
  agent: () => nextAgentId++,
  session: () => `session-${nextSessionId++}`
}
