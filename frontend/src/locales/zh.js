export default {
  common: {
    save: '保存',
    cancel: '取消',
    delete: '删除',
    edit: '编辑',
    create: '创建',
    add: '添加',
    loading: '加载中...',
    confirm: '确认',
    success: '成功',
    error: '错误',
    search: '搜索',
    actions: '操作',
    enabled: '已启用',
    disabled: '已禁用',
    yes: '是',
    no: '否',
    all: '全部',
    none: '无',
    back: '返回',
    close: '关闭',
    required: '必填',
    optional: '可选'
  },
  nav: {
    kanban: '看板',
    taskSources: '任务源',
    agents: '智能代理',
    settings: '设置'
  },
  project: {
    title: '项目',
    selectProject: '选择项目',
    noProject: '未选择项目',
    createProject: '创建项目',
    editProject: '编辑项目',
    projectName: '项目名称',
    description: '描述',
    repositoryUrl: '仓库地址',
    deleteConfirm: '确定要删除此项目吗？'
  },
  task: {
    title: '任务',
    createTask: '创建任务',
    editTask: '编辑任务',
    taskTitle: '标题',
    taskDescription: '描述',
    status: '状态',
    priority: '优先级',
    assignee: '负责人',
    dueDate: '截止日期',
    deleteConfirm: '确定要删除此任务吗？',
    noTasks: '暂无任务',
    addTask: '+ 添加任务'
  },
  status: {
    TODO: '待处理',
    DESIGN: '设计',
    DEVELOPMENT: '开发',
    TESTING: '测试',
    RELEASE: '发布',
    DONE: '已完成'
  },
  priority: {
    LOW: '低',
    MEDIUM: '中',
    HIGH: '高',
    CRITICAL: '紧急'
  },
  taskSource: {
    title: '任务源',
    createSource: '创建任务源',
    editSource: '编辑任务源',
    sourceName: '名称',
    sourceType: '类型',
    config: '配置',
    syncInterval: '同步间隔 (分钟)',
    lastSync: '上次同步',
    syncNow: '立即同步',
    testConnection: '测试连接',
    connectionSuccess: '连接成功',
    connectionFailed: '连接失败',
    syncing: '同步中...',
    types: {
      LOCAL: '本地',
      GITHUB: 'GitHub Issues',
      JIRA: 'Jira',
      CUSTOM: '自定义'
    }
  },
  agent: {
    title: '智能代理',
    createAgent: '创建代理',
    editAgent: '编辑代理',
    agentName: '名称',
    agentType: '类型',
    command: '命令模板',
    config: '配置',
    deleteConfirm: '确定要删除此代理吗？',
    types: {
      CLAUDE: 'Claude Code',
      CODEX: 'OpenAI Codex',
      CURSOR: 'Cursor',
      GEMINI: 'Gemini',
      CUSTOM: '自定义'
    },
    commandHint: '使用 {prompt} 作为任务提示的占位符'
  },
  execution: {
    title: '执行记录',
    startExecution: '开始执行',
    selectAgent: '选择代理...',
    execute: '执行',
    stop: '停止',
    status: '状态',
    output: '输出',
    startedAt: '开始时间',
    completedAt: '完成时间',
    statuses: {
      PENDING: '等待中',
      RUNNING: '运行中',
      SUCCESS: '成功',
      FAILED: '失败',
      CANCELLED: '已取消'
    }
  },
  session: {
    title: '会话',
    createSession: '创建会话',
    startSession: '启动会话',
    stopSession: '停止会话',
    deleteSession: '删除会话',
    continueSession: '继续',
    status: {
      none: '无会话',
      created: '已创建',
      running: '运行中',
      idle: '空闲',
      stopped: '已停止',
      error: '错误',
      completed: '已完成'
    }
  },
  chat: {
    title: '聊天',
    you: '你',
    assistant: '助手',
    inputPlaceholder: '输入消息... (回车发送)',
    noSession: '无活动会话',
    noSessionHint: '选择一个代理并启动会话以开始聊天',
    readyTitle: '准备就绪',
    readyHint: '点击"启动"开始对话',
    taskSummary: '简介'
  },
  validation: {
    required: '此字段必填',
    titleRequired: '标题必填',
    minLength: '最少需要 {min} 个字符',
    maxLength: '最多允许 {max} 个字符',
    invalid: '无效的值'
  },
  messages: {
    created: '{name} 创建成功',
    updated: '{name} 更新成功',
    deleted: '{name} 删除成功',
    saved: '{name} 保存成功',
    createFailed: '{name} 创建失败',
    updateFailed: '{name} 更新失败',
    deleteFailed: '{name} 删除失败',
    saveFailed: '{name} 保存失败'
  }
}
