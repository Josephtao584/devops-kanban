// Agent类型配置
export const agentConfig = {
  CLAUDE: { color: "#8B5CF6", icon: "🤖", name: "Claude" },
  CODEX: { color: "#10B981", icon: "💻", name: "Codex" },
  CURSOR: { color: "#F59E0B", icon: "✨", name: "Cursor" },
  GEMINI: { color: "#3B82F6", icon: "🔮", name: "Gemini" }
}

// 节点状态配置
export const nodeStatusConfig = {
  DONE: { color: "#10B981", icon: "✓" },
  IN_PROGRESS: { color: "#3B82F6", icon: "▶" },
  PENDING: { color: "#6B7280", icon: "○" }
}

// Mock Workflow数据 - 每个任务对应一个工作流
export const mockWorkflows = [
  // ========== 任务1: 实现用户登录功能 (DONE) - OAuth认证开发流程 ==========
  {
    id: 1,
    name: "OAuth登录功能开发",
    taskId: 1,
    projectId: 1,
    currentNodeId: 5,
    stages: [
      {
        id: "task1-stage-1",
        name: "需求分析",
        order: 1,
        nodes: [
          {
            id: 1,
            name: "OAuth方案设计",
            role: "架构师",
            agentType: "CLAUDE",
            agentName: "Claude Architect",
            status: "DONE",
            duration: 20,
            task: { id: 1, title: "OAuth方案设计", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "请设计OAuth2.0登录方案，需要支持GitHub和Google。" },
              { id: 2, from: "assistant", content: "OAuth2.0方案设计完成：\n\n**支持的登录方式**\n- GitHub OAuth\n- Google OAuth\n\n**技术方案**\n1. 使用Spring Security OAuth2 Client\n2. JWT Token存储用户信息\n3. 统一回调处理接口\n\n安全考虑：state参数防CSRF，PKCE扩展。" }
            ]
          }
        ]
      },
      {
        id: "task1-stage-2",
        name: "后端开发",
        order: 2,
        parallel: true,
        parentNode: {
          id: "parent-task1-stage-2",
          name: "后端开发",
          role: "技术负责人",
          agentType: "CLAUDE",
          agentName: "Claude Lead",
          status: "DONE",
        },
        nodes: [
          {
            id: 2,
            name: "GitHub OAuth",
            role: "后端开发",
            agentType: "CODEX",
            agentName: "Codex GitHub",
            status: "DONE",
            duration: 30,
            task: { id: 1, title: "GitHub OAuth集成", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "实现GitHub OAuth登录后端。" },
              { id: 2, from: "assistant", content: "GitHub OAuth已完成：\n✅ 注册GitHub OAuth App\n✅ 配置回调URL\n✅ 实现授权码换取Token\n✅ 获取用户信息接口\n✅ 用户自动注册/登录" }
            ]
          },
          {
            id: 3,
            name: "Google OAuth",
            role: "后端开发",
            agentType: "GEMINI",
            agentName: "Gemini Google",
            status: "DONE",
            duration: 25,
            task: { id: 1, title: "Google OAuth集成", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "实现Google OAuth登录后端。" },
              { id: 2, from: "assistant", content: "Google OAuth已完成：\n✅ Google Cloud Console配置\n✅ OAuth 2.0客户端ID\n✅ 实现授权流程\n✅ 用户信息解析\n✅ 与GitHub统一用户体系" }
            ]
          }
        ]
      },
      {
        id: "task1-stage-3",
        name: "前端集成",
        order: 3,
        nodes: [
          {
            id: 4,
            name: "登录页面",
            role: "前端开发",
            agentType: "CURSOR",
            agentName: "Cursor FE",
            status: "DONE",
            duration: 15,
            task: { id: 1, title: "登录页面开发", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "开发OAuth登录按钮和流程。" },
              { id: 2, from: "assistant", content: "登录页面完成：\n✅ GitHub登录按钮\n✅ Google登录按钮\n✅ 回调处理页面\n✅ 登录状态管理\n✅ 错误处理提示" }
            ]
          }
        ]
      },
      {
        id: "task1-stage-4",
        name: "测试上线",
        order: 4,
        nodes: [
          {
            id: 5,
            name: "功能测试",
            role: "测试工程师",
            agentType: "CLAUDE",
            agentName: "Claude QA",
            status: "DONE",
            duration: 10,
            task: { id: 1, title: "OAuth功能测试", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "测试OAuth登录功能。" },
              { id: 2, from: "assistant", content: "测试完成，所有功能正常：\n✅ GitHub登录流程\n✅ Google登录流程\n✅ 用户信息获取\n✅ Token刷新\n✅ 登出功能\n\n功能已上线！" }
            ]
          }
        ]
      }
    ]
  },

  // ========== 任务2: 优化数据库查询性能 (IN_PROGRESS) - 性能优化流程 ==========
  {
    id: 2,
    name: "数据库性能优化",
    taskId: 2,
    projectId: 1,
    currentNodeId: 8,
    stages: [
      {
        id: "task2-stage-1",
        name: "问题诊断",
        order: 1,
        nodes: [
          {
            id: 6,
            name: "慢查询分析",
            role: "DBA",
            agentType: "GEMINI",
            agentName: "Gemini DBA",
            status: "DONE",
            duration: 15,
            task: { id: 2, title: "慢查询分析", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "分析数据库慢查询日志。" },
              { id: 2, from: "assistant", content: "分析完成，发现以下慢查询：\n\n**TOP 3 慢查询**\n1. `SELECT * FROM tasks WHERE status = ?` - 平均 2.3s\n2. `SELECT * FROM users WHERE email LIKE ?` - 平均 1.8s\n3. `COUNT(*) FROM sessions` - 平均 1.2s\n\n**问题原因**\n- 缺少索引\n- 全表扫描\n- 未使用覆盖索引" }
            ]
          }
        ]
      },
      {
        id: "task2-stage-2",
        name: "优化方案",
        order: 2,
        parallel: true,
        parentNode: {
          id: "parent-task2-stage-2",
          name: "优化方案",
          role: "技术负责人",
          agentType: "CLAUDE",
          agentName: "Claude Lead",
          status: "IN_PROGRESS",
          messages: [
            { id: 1, from: "user", content: "请制定数据库性能优化方案，需要并行执行索引优化和SQL重构。" },
            { id: 2, from: "assistant", content: "**数据库优化方案**\n\n根据慢查询分析结果，我已分配以下并行任务：\n\n1. **索引优化** - Gemini Index 负责\n   - 为tasks表添加复合索引\n   - 为users表添加email索引\n   - 为sessions表添加覆盖索引\n\n2. **SQL重构** - Codex SQL 负责\n   - 重构tasks查询使用覆盖索引\n   - 重构users查询改用精确匹配\n   - sessions统计使用缓存\n\n预计索引优化10分钟，SQL重构正在执行中..." },
            { id: 3, from: "user", content: "当前进度如何？" },
            { id: 4, from: "assistant", content: "**📊 优化进度汇报**\n\n**索引优化** - ✅ 已完成\n- ✅ CREATE INDEX idx_tasks_status ON tasks(status, project_id);\n- ✅ CREATE INDEX idx_users_email ON users(email);\n- ✅ CREATE INDEX idx_sessions_task ON sessions(task_id, created_at);\n\n**SQL重构** - 🔄 进行中\n- ✅ tasks查询 - 改用覆盖索引\n- ✅ users查询 - 添加精确匹配\n- 🔄 sessions统计 - 使用缓存\n- ⏳ 添加查询缓存\n\n预计还需20分钟完成SQL重构..." }
          ]
        },
        nodes: [
          {
            id: 7,
            name: "索引优化",
            role: "DBA",
            agentType: "GEMINI",
            agentName: "Gemini Index",
            status: "DONE",
            duration: 10,
            task: { id: 2, title: "索引优化", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "设计优化索引方案。" },
              { id: 2, from: "assistant", content: "索引方案：\n```sql\nCREATE INDEX idx_tasks_status ON tasks(status, project_id);\nCREATE INDEX idx_users_email ON users(email);\nCREATE INDEX idx_sessions_task ON sessions(task_id, created_at);\n```\n索引已创建，预计提升 80% 查询性能。" }
            ]
          },
          {
            id: 8,
            name: "SQL重构",
            role: "后端开发",
            agentType: "CODEX",
            agentName: "Codex SQL",
            status: "IN_PROGRESS",
            task: { id: 2, title: "SQL重构", status: "IN_PROGRESS" },
            messages: [
              { id: 1, from: "user", content: "重构慢查询SQL语句。" },
              { id: 2, from: "assistant", content: "正在重构SQL：\n\n✅ tasks查询 - 改用覆盖索引\n✅ users查询 - 添加精确匹配\n🔄 sessions统计 - 使用缓存\n⏳ 添加查询缓存\n\n预计还需 20 分钟..." }
            ]
          }
        ]
      },
      {
        id: "task2-stage-3",
        name: "效果验证",
        order: 3,
        nodes: [
          {
            id: 9,
            name: "性能测试",
            role: "测试工程师",
            agentType: "CLAUDE",
            agentName: "Claude Perf",
            status: "PENDING",
            task: { id: 2, title: "性能测试", status: "TODO" },
            messages: []
          }
        ]
      }
    ]
  },

  // ========== 任务3: 添加任务导出功能 (TODO) - 新功能开发流程 ==========
  {
    id: 3,
    name: "任务导出功能开发",
    taskId: 3,
    projectId: 1,
    currentNodeId: 10,
    stages: [
      {
        id: "task3-stage-1",
        name: "需求确认",
        order: 1,
        nodes: [
          {
            id: 10,
            name: "导出需求分析",
            role: "产品经理",
            agentType: "CLAUDE",
            agentName: "Claude PM",
            status: "PENDING",
            task: { id: 3, title: "导出需求分析", status: "TODO" },
            messages: [
              { id: 1, from: "user", content: "分析任务导出功能需求。" },
              { id: 2, from: "assistant", content: "导出功能需求：\n\n**支持格式**\n- Excel (.xlsx)\n- PDF\n\n**导出内容**\n- 任务标题、描述\n- 状态、优先级\n- 创建/更新时间\n- 负责人\n\n**筛选条件**\n- 按项目\n- 按状态\n- 按时间范围" }
            ]
          }
        ]
      },
      {
        id: "task3-stage-2",
        name: "后端开发",
        order: 2,
        parallel: true,
        parentNode: {
          id: "parent-task3-stage-2",
          name: "后端开发",
          role: "技术负责人",
          agentType: "CLAUDE",
          agentName: "Claude Lead",
          status: "PENDING",
          messages: [
            { id: 1, from: "user", content: "请分配后端开发任务，需要同时支持Excel和PDF两种导出格式。" },
            { id: 2, from: "assistant", content: "**导出功能后端开发计划**\n\n我将分配以下并行任务：\n\n1. **Excel导出** - Codex Excel 负责\n   - 使用Apache POI生成Excel\n   - 支持样式设置\n   - 大数据量分sheet处理\n\n2. **PDF导出** - Gemini PDF 负责\n   - 使用iText生成PDF\n   - 支持中文字体\n   - 表格格式化\n\n等待需求确认后开始开发。" }
          ]
        },
        nodes: [
          {
            id: 11,
            name: "Excel导出",
            role: "后端开发",
            agentType: "CODEX",
            agentName: "Codex Excel",
            status: "PENDING",
            task: { id: 3, title: "Excel导出API", status: "TODO" },
            messages: []
          },
          {
            id: 12,
            name: "PDF导出",
            role: "后端开发",
            agentType: "GEMINI",
            agentName: "Gemini PDF",
            status: "PENDING",
            task: { id: 3, title: "PDF导出API", status: "TODO" },
            messages: []
          }
        ]
      },
      {
        id: "task3-stage-3",
        name: "前端开发",
        order: 3,
        nodes: [
          {
            id: 13,
            name: "导出UI",
            role: "前端开发",
            agentType: "CURSOR",
            agentName: "Cursor Export",
            status: "PENDING",
            task: { id: 3, title: "导出UI组件", status: "TODO" },
            messages: []
          }
        ]
      }
    ]
  },

  // ========== 任务4: 修复分页组件Bug (TODO) - Bug修复流程 ==========
  {
    id: 4,
    name: "分页组件Bug修复",
    taskId: 4,
    projectId: 1,
    currentNodeId: 14,
    stages: [
      {
        id: "task4-stage-1",
        name: "问题定位",
        order: 1,
        nodes: [
          {
            id: 14,
            name: "Bug复现",
            role: "测试工程师",
            agentType: "CLAUDE",
            agentName: "Claude QA",
            status: "PENDING",
            task: { id: 4, title: "Bug复现与分析", status: "TODO" },
            messages: [
              { id: 1, from: "user", content: "复现分页组件的Bug。" },
              { id: 2, from: "assistant", content: "Bug复现结果：\n\n**问题描述**\n当数据为空时，分页组件显示异常\n\n**复现步骤**\n1. 进入任务列表\n2. 筛选一个没有数据的状态\n3. 分页组件显示 `-1 / 0` 页\n\n**根本原因**\n`totalPages` 计算未考虑空数据边界情况" }
            ]
          }
        ]
      },
      {
        id: "task4-stage-2",
        name: "修复开发",
        order: 2,
        nodes: [
          {
            id: 15,
            name: "代码修复",
            role: "前端开发",
            agentType: "CURSOR",
            agentName: "Cursor Fix",
            status: "PENDING",
            task: { id: 4, title: "分页组件修复", status: "TODO" },
            messages: []
          }
        ]
      },
      {
        id: "task4-stage-3",
        name: "验证发布",
        order: 3,
        nodes: [
          {
            id: 16,
            name: "回归测试",
            role: "测试工程师",
            agentType: "CLAUDE",
            agentName: "Claude Test",
            status: "PENDING",
            task: { id: 4, title: "回归测试", status: "TODO" },
            messages: []
          }
        ]
      }
    ]
  },

  // ========== 任务5: 集成消息通知服务 (TODO) - 第三方集成流程 ==========
  {
    id: 5,
    name: "消息通知服务集成",
    taskId: 5,
    projectId: 1,
    currentNodeId: 17,
    stages: [
      {
        id: "task5-stage-1",
        name: "API对接准备",
        order: 1,
        parallel: true,
        parentNode: {
          id: "parent-task5-stage-1",
          name: "API对接准备",
          role: "技术负责人",
          agentType: "CLAUDE",
          agentName: "Claude Lead",
          status: "PENDING",
          messages: [
            { id: 1, from: "user", content: "请安排消息通知服务的API对接准备工作，需要同时配置企业微信和钉钉。" },
            { id: 2, from: "assistant", content: "**消息通知API对接计划**\n\n我将并行分配以下配置任务：\n\n1. **企业微信配置** - Codex WeCom 负责\n   - 创建群机器人\n   - 获取Webhook URL\n   - 配置安全设置\n   - 支持文本/Markdown/卡片消息\n\n2. **钉钉配置** - Gemini DingTalk 负责\n   - 创建自定义机器人\n   - 设置加签密钥\n   - 获取Webhook URL\n   - 支持文本/Link/Markdown消息\n\n等待开始执行..." }
          ]
        },
        nodes: [
          {
            id: 17,
            name: "企业微信配置",
            role: "后端开发",
            agentType: "CODEX",
            agentName: "Codex WeCom",
            status: "PENDING",
            task: { id: 5, title: "企业微信机器人配置", status: "TODO" },
            messages: [
              { id: 1, from: "user", content: "配置企业微信机器人Webhook。" },
              { id: 2, from: "assistant", content: "企业微信配置步骤：\n\n1. 创建群机器人\n2. 获取Webhook URL\n3. 配置安全设置\n\n**支持的消息类型**\n- 文本消息\n- Markdown消息\n- 任务卡片" }
            ]
          },
          {
            id: 18,
            name: "钉钉配置",
            role: "后端开发",
            agentType: "GEMINI",
            agentName: "Gemini DingTalk",
            status: "PENDING",
            task: { id: 5, title: "钉钉机器人配置", status: "TODO" },
            messages: [
              { id: 1, from: "user", content: "配置钉钉机器人Webhook。" },
              { id: 2, from: "assistant", content: "钉钉配置步骤：\n\n1. 创建自定义机器人\n2. 设置加签密钥\n3. 获取Webhook URL\n\n**支持的消息类型**\n- 文本消息\n- Link消息\n- Markdown消息" }
            ]
          }
        ]
      },
      {
        id: "task5-stage-2",
        name: "通知服务开发",
        order: 2,
        nodes: [
          {
            id: 19,
            name: "通知服务封装",
            role: "后端开发",
            agentType: "CLAUDE",
            agentName: "Claude Notify",
            status: "PENDING",
            task: { id: 5, title: "通知服务封装", status: "TODO" },
            messages: []
          }
        ]
      },
      {
        id: "task5-stage-3",
        name: "事件集成",
        order: 3,
        nodes: [
          {
            id: 20,
            name: "任务事件通知",
            role: "后端开发",
            agentType: "CODEX",
            agentName: "Codex Events",
            status: "PENDING",
            task: { id: 5, title: "任务事件通知集成", status: "TODO" },
            messages: []
          }
        ]
      }
    ]
  },

  // ========== 任务8: 优化页面加载速度 (IN_PROGRESS) - 前端性能优化流程 ==========
  {
    id: 8,
    name: "前端性能优化",
    taskId: 8,
    projectId: 1,
    currentNodeId: 23,
    stages: [
      {
        id: "task8-stage-1",
        name: "性能诊断",
        order: 1,
        nodes: [
          {
            id: 21,
            name: "性能分析",
            role: "前端开发",
            agentType: "CURSOR",
            agentName: "Cursor FE",
            status: "DONE",
            duration: 15,
            task: { id: 8, title: "前端性能分析", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "分析当前页面加载性能，找出瓶颈。" },
              { id: 2, from: "assistant", content: "性能分析报告：\n\n**Lighthouse评分**\n- Performance: 62分\n- First Contentful Paint: 2.8s\n- Largest Contentful Paint: 4.2s\n- Time to Interactive: 5.1s\n\n**主要问题**\n1. JavaScript包体积过大 (2.3MB)\n2. 未使用代码分割\n3. 图片未压缩\n4. 字体加载阻塞渲染\n5. 第三方库未按需加载" }
            ]
          }
        ]
      },
      {
        id: "task8-stage-2",
        name: "优化实施",
        order: 2,
        parallel: true,
        parentNode: {
          id: "parent-task8-stage-2",
          name: "优化实施",
          role: "技术负责人",
          agentType: "CLAUDE",
          agentName: "Claude Lead",
          status: "IN_PROGRESS",
          messages: [
            { id: 1, from: "user", content: "请制定前端性能优化方案，并行实施各项优化措施。" },
            { id: 2, from: "assistant", content: "**前端性能优化方案**\n\n根据分析结果，我已分配以下并行优化任务：\n\n1. **代码分割优化** - Cursor Split 负责\n   - 路由懒加载\n   - 组件动态导入\n   - 第三方库分包\n\n2. **资源优化** - Gemini Assets 负责\n   - 图片WebP转换\n   - 图片懒加载\n   - 字体预加载\n\n预计代码分割优化15分钟，资源优化进行中..." }
          ]
        },
        nodes: [
          {
            id: 22,
            name: "代码分割",
            role: "前端开发",
            agentType: "CURSOR",
            agentName: "Cursor Split",
            status: "DONE",
            duration: 15,
            task: { id: 8, title: "代码分割优化", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "实施代码分割，减少首屏加载体积。" },
              { id: 2, from: "assistant", content: "代码分割完成：\n\n✅ 路由懒加载\n- 每个页面独立chunk\n- 首屏只加载必要代码\n\n✅ 组件动态导入\n- 大型组件按需加载\n- TaskDetail、DiffViewer等\n\n✅ 第三方库分包\n- vendor.js: 800KB\n- element-plus: 300KB\n- vue-vendor: 150KB\n\n**优化效果**\n首屏JS体积: 2.3MB → 450KB (-80%)" }
            ]
          },
          {
            id: 23,
            name: "资源优化",
            role: "前端开发",
            agentType: "GEMINI",
            agentName: "Gemini Assets",
            status: "IN_PROGRESS",
            task: { id: 8, title: "资源加载优化", status: "IN_PROGRESS" },
            messages: [
              { id: 1, from: "user", content: "优化静态资源加载策略。" },
              { id: 2, from: "assistant", content: "正在优化资源加载：\n\n✅ 图片WebP转换\n- PNG → WebP 节省 60%\n- 添加fallback支持\n\n✅ 图片懒加载\n- 使用Intersection Observer\n- 占位图优化\n\n🔄 字体优化\n- 使用font-display: swap\n- 预加载关键字体\n\n⏳ CDN配置中...\n\n预计还需10分钟..." }
            ]
          }
        ]
      },
      {
        id: "task8-stage-3",
        name: "效果验证",
        order: 3,
        nodes: [
          {
            id: 24,
            name: "性能测试",
            role: "测试工程师",
            agentType: "CLAUDE",
            agentName: "Claude Perf",
            status: "PENDING",
            task: { id: 8, title: "性能回归测试", status: "TODO" },
            messages: []
          }
        ]
      }
    ]
  }
]

// 扁平化获取所有节点（用于查找）
export function getAllNodes(workflow) {
  if (!workflow?.stages) return []
  return workflow.stages.flatMap(stage => stage.nodes)
}

// 获取指定项目的workflow（返回第一个匹配的）
export function getWorkflowByProject(projectId) {
  return mockWorkflows.find(w => w.projectId === projectId)
}

// 获取指定任务的workflow
export function getWorkflowByTask(taskId) {
  return mockWorkflows.find(w => w.taskId === taskId)
}

// 获取指定workflow
export function getWorkflowById(workflowId) {
  return mockWorkflows.find(w => w.id === workflowId)
}

// 获取节点详情
export function getNodeById(workflowId, nodeId) {
  const workflow = getWorkflowById(workflowId)
  if (!workflow) return null
  const allNodes = getAllNodes(workflow)
  return allNodes.find(n => n.id === nodeId)
}

// 计算工作流进度
export function getWorkflowProgress(workflow) {
  const allNodes = getAllNodes(workflow)
  if (allNodes.length === 0) return { completed: 0, total: 0, percent: 0 }
  const completed = allNodes.filter(n => n.status === 'DONE').length
  return {
    completed,
    total: allNodes.length,
    percent: Math.round((completed / allNodes.length) * 100)
  }
}

// ========== Dynamic Workflow Node Methods ==========

/**
 * Add a node to a specific stage in a workflow
 * @param {number|string} workflowId - Workflow ID
 * @param {string} stageId - Stage ID
 * @param {Object} nodeData - Node data to add
 * @returns {Object|null} Added node or null if failed
 */
export function addNodeToStage(workflowId, stageId, nodeData) {
  const workflow = getWorkflowById(workflowId)
  if (!workflow) {
    console.warn(`Workflow not found: ${workflowId}`)
    return null
  }

  const stage = workflow.stages.find(s => s.id === stageId)
  if (!stage) {
    console.warn(`Stage not found: ${stageId}`)
    return null
  }

  // Ensure nodes array exists
  if (!stage.nodes) {
    stage.nodes = []
  }

  // Add the node
  stage.nodes.push(nodeData)

  console.log(`Added node "${nodeData.name}" to stage "${stage.name}"`)
  return nodeData
}

/**
 * Add a node to the best suitable stage in a workflow
 * @param {number|string} workflowId - Workflow ID
 * @param {Object} nodeData - Node data to add
 * @param {string} preferredStageType - Preferred stage type (e.g., 'development', 'testing')
 * @returns {Object|null} Added node or null if failed
 */
export function addNodeToWorkflow(workflowId, nodeData, preferredStageType = 'development') {
  const workflow = getWorkflowById(workflowId)
  if (!workflow) {
    console.warn(`Workflow not found: ${workflowId}`)
    return null
  }

  // Find suitable stage
  let targetStage = null

  // Try to find stage matching preferred type
  targetStage = workflow.stages.find(s =>
    s.name.toLowerCase().includes(preferredStageType.toLowerCase())
  )

  // Fallback to first non-parallel stage or just first stage
  if (!targetStage) {
    targetStage = workflow.stages.find(s => !s.parallel) || workflow.stages[0]
  }

  if (!targetStage) {
    console.warn(`No suitable stage found in workflow ${workflowId}`)
    return null
  }

  return addNodeToStage(workflowId, targetStage.id, nodeData)
}

/**
 * Create a new workflow for a project
 * @param {number} projectId - Project ID
 * @param {string} name - Workflow name
 * @returns {Object} Created workflow
 */
export function createWorkflowForProject(projectId, name = 'Default Workflow') {
  const newId = Math.max(...mockWorkflows.map(w => w.id), 0) + 1

  const newWorkflow = {
    id: newId,
    name: name,
    projectId: projectId,
    currentNodeId: null,
    stages: [
      {
        id: `stage-${newId}-1`,
        name: '设计',
        order: 1,
        nodes: []
      },
      {
        id: `stage-${newId}-2`,
        name: '开发',
        order: 2,
        parallel: true,
        nodes: []
      },
      {
        id: `stage-${newId}-3`,
        name: '测试',
        order: 3,
        nodes: []
      },
      {
        id: `stage-${newId}-4`,
        name: '发布',
        order: 4,
        nodes: []
      }
    ]
  }

  mockWorkflows.push(newWorkflow)
  return newWorkflow
}

/**
 * Get or create workflow for a project
 * @param {number} projectId - Project ID
 * @returns {Object} Workflow object
 */
export function getOrCreateWorkflowForProject(projectId) {
  let workflow = getWorkflowByProject(projectId)

  if (!workflow) {
    workflow = createWorkflowForProject(projectId, `项目 ${projectId} 工作流`)
  }

  return workflow
}

/**
 * Update node status in a workflow
 * @param {number|string} workflowId - Workflow ID
 * @param {number|string} nodeId - Node ID
 * @param {string} status - New status ('PENDING', 'IN_PROGRESS', 'DONE')
 * @returns {boolean} Success status
 */
export function updateNodeStatus(workflowId, nodeId, status) {
  const workflow = getWorkflowById(workflowId)
  if (!workflow) return false

  const node = getAllNodes(workflow).find(n => n.id === nodeId)
  if (!node) return false

  node.status = status
  return true
}

/**
 * Remove a node from workflow
 * @param {number|string} workflowId - Workflow ID
 * @param {number|string} nodeId - Node ID
 * @returns {boolean} Success status
 */
export function removeNodeFromWorkflow(workflowId, nodeId) {
  const workflow = getWorkflowById(workflowId)
  if (!workflow) return false

  for (const stage of workflow.stages) {
    const index = stage.nodes?.findIndex(n => n.id === nodeId)
    if (index !== undefined && index > -1) {
      stage.nodes.splice(index, 1)
      return true
    }
  }

  return false
}
