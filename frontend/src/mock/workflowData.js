// Agent 类型配置
export const agentConfig = {
  CLAUDE: { color: "#8B5CF6", icon: "Monitor", name: "Claude" },
  CODEX: { color: "#10B981", icon: "VideoPlay", name: "Codex" },
  CURSOR: { color: "#F59E0B", icon: "Edit", name: "Cursor" },
  GEMINI: { color: "#3B82F6", icon: "Cpu", name: "Gemini" }
}

// 角色配置 - 包含新增角色
export const roleConfig = {
  // 原有角色
  "架构师": { icon: "OfficeBuilding", color: "#8B5CF6", level: 1 },
  "技术负责人": { icon: "User", color: "#F59E0B", level: 2 },
  "后端开发": { icon: "Setting", color: "#10B981", level: 3 },
  "前端开发": { icon: "Brush", color: "#3B82F6", level: 3 },
  "测试工程师": { icon: "Search", color: "#EC4899", level: 4 },
  "DBA": { icon: "Coin", color: "#6366F1", level: 3 },
  "产品经理": { icon: "Document", color: "#14B8A6", level: 1 },
  // 新增角色
  "Tech Lead": { icon: "Aim", color: "#DC2626", level: 2 },
  "Committer": { icon: "CircleCheck", color: "#7C3AED", level: 1 },
  "Reviewer": { icon: "View", color: "#059669", level: 4 },
  "Security Engineer": { icon: "Lock", color: "#DC2626", level: 2 },
  "DevOps Engineer": { icon: "Promotion", color: "#EA580C", level: 3 },
  "Release Manager": { icon: "Box", color: "#0284C7", level: 1 }
}

// 节点状态配置 - 新增 FAILED 和 REJECTED 状态
export const nodeStatusConfig = {
  DONE: { color: "#10B981", icon: "✓" },
  IN_PROGRESS: { color: "#3B82F6", icon: "▶" },
  PENDING: { color: "#6B7280", icon: "○" },
  FAILED: { color: "#DC2626", icon: "✗" },
  REJECTED: { color: "#F59E0B", icon: "↩" }
}

// Mock Workflow 数据 - 每个任务对应一个工作流
// 数据结构说明：
// - stages: 按顺序执行的阶段（串行）
// - 每个 stage 内的 nodes 是并行执行的
// - rollbackEdges: 打回路径，fromId 是打回发起点，toId 是需要重做的节点
export const mockWorkflows = [
  // ========== 任务 1: 实现用户登录功能 (DONE) - OAuth 认证开发流程 ==========
  {
    id: 1,
    name: "OAuth 登录功能开发",
    taskId: 1,
    projectId: 1,
    currentNodeId: 8,
    stages: [
      {
        id: "task1-stage-1",
        name: "需求分析",
        order: 1,
        nodes: [
          {
            id: 1,
            name: "OAuth 方案设计",
            role: "架构师",
            agentType: "CLAUDE",
            agentName: "Claude Architect",
            status: "DONE",
            duration: 20,
            task: { id: 1, title: "OAuth 方案设计", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "请设计 OAuth2.0 登录方案，需要支持 GitHub 和 Google。" },
              { id: 2, from: "assistant", content: "OAuth2.0 方案设计完成。采用 Authorization Code Flow + PKCE，支持 GitHub 和 Google 两家 provider。使用 JWT 进行会话管理，token 有效期 24 小时，refresh token 有效期 7 天。" }
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
          role: "Tech Lead",
          agentType: "CLAUDE",
          agentName: "Claude Lead",
          status: "DONE",
          messages: [
            { id: 1, from: "user", content: "Please coordinate the OAuth backend implementation, ensure both GitHub and Google integrations follow security best practices." },
            { id: 2, from: "assistant", content: "Coordinating OAuth implementation. Assigned GitHub OAuth to Codex and Google OAuth to Gemini. Setting up unified callback endpoints and token management." }
          ]
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
            task: { id: 1, title: "GitHub OAuth 集成", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "Implement GitHub OAuth authentication with scope: user:email." },
              { id: 2, from: "assistant", content: "GitHub OAuth implemented. Created /auth/github/callback endpoint, JWT token generation, and user session management." }
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
            task: { id: 1, title: "Google OAuth 集成", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "Implement Google OAuth with OpenID Connect, request email and profile scopes." },
              { id: 2, from: "assistant", content: "Google OAuth completed. Integrated google-auth-library, verified ID tokens, and created unified user model." }
            ]
          }
        ]
      },
      {
        id: "task1-stage-3",
        name: "前端开发",
        order: 3,
        nodes: [
          {
            id: 4,
            name: "登录页面开发",
            role: "前端开发",
            agentType: "CURSOR",
            agentName: "Cursor Frontend",
            status: "DONE",
            duration: 25,
            task: { id: 1, title: "登录页面开发", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "Create login page with GitHub and Google OAuth buttons." },
              { id: 2, from: "assistant", content: "Login page created with Vue 3. Added OAuth buttons, callback handler, and user profile display after login. Integrated with Vuex for auth state management." }
            ]
          }
        ]
      },
      {
        id: "task1-stage-4",
        name: "代码审查",
        order: 4,
        nodes: [
          {
            id: 31,
            name: "代码 Review",
            role: "Reviewer",
            agentType: "CLAUDE",
            agentName: "Claude Reviewer",
            status: "DONE",
            duration: 12,
            task: { id: 1, title: "代码审查", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "Review OAuth implementation for security vulnerabilities and code quality." },
              { id: 2, from: "assistant", content: "Code review passed. Verified: 1) PKCE flow for CSRF protection, 2) Secure token storage, 3) Input validation on callbacks. LGTM." }
            ]
          },
          {
            id: 32,
            name: "Committer 审批",
            role: "Committer",
            agentType: "CLAUDE",
            agentName: "Code Committer",
            status: "DONE",
            duration: 8,
            task: { id: 1, title: "Committer 审批", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "Approve OAuth implementation for merge." },
              { id: 2, from: "assistant", content: "APPROVED: All review comments addressed, CI pipeline passing. Ready to merge into main branch." }
            ]
          }
        ]
      },
      {
        id: "task1-stage-5",
        name: "测试上线",
        order: 5,
        nodes: [
          {
            id: 5,
            name: "功能测试",
            role: "测试工程师",
            agentType: "CLAUDE",
            agentName: "Claude QA",
            status: "DONE",
            duration: 10,
            task: { id: 1, title: "OAuth 功能测试", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "Test OAuth login flow end-to-end, including edge cases." },
              { id: 2, from: "assistant", content: "All tests passed: happy path, expired tokens, revoked access, and concurrent sessions. Ready for production." }
            ]
          },
          {
            id: 6,
            name: "发布部署",
            role: "DevOps Engineer",
            agentType: "CODEX",
            agentName: "DevOps Deploy",
            status: "DONE",
            duration: 8,
            task: { id: 1, title: "发布部署", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "Deploy OAuth feature to production with canary release." },
              { id: 2, from: "assistant", content: "Deployed to production with 10% canary traffic. Monitoring dashboards set up, no errors detected in first hour." }
            ]
          }
        ]
      }
    ]
  },

  // ========== 任务 2: 优化数据库查询性能 (IN_PROGRESS) - 性能优化流程 ==========
  {
    id: 2,
    name: "数据库性能优化",
    taskId: 2,
    projectId: 1,
    currentNodeId: 11,
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
              { id: 1, from: "user", content: "Analyze slow query log and identify performance bottlenecks." },
              { id: 2, from: "assistant", content: "Found 3 slow queries: 1) Missing index on user_email (avg 2.3s), 2) N+1 in task lookup, 3) Full table scan on status filter. Recommending indexes and query refactoring." }
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
          role: "Tech Lead",
          agentType: "CLAUDE",
          agentName: "Claude Lead",
          status: "DONE",
          messages: [
            { id: 1, from: "user", content: "Review optimization plan and coordinate implementation." },
            { id: 2, from: "assistant", content: "Split optimization into parallel tasks: Index optimization (Gemini) and SQL refactoring (Codex). Setting up performance benchmarks for validation." }
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
              { id: 1, from: "user", content: "Create indexes for user_email, task_status, and project_id columns." },
              { id: 2, from: "assistant", content: "Indexes created: idx_user_email, idx_task_status, idx_project_id. Query time reduced by 78% on average." }
            ]
          },
          {
            id: 8,
            name: "SQL 重构",
            role: "后端开发",
            agentType: "CODEX",
            agentName: "Codex SQL",
            status: "DONE",
            duration: 20,
            task: { id: 2, title: "SQL 重构", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "Refactor N+1 queries using JOIN and eager loading." },
              { id: 2, from: "assistant", content: "Refactored task queries with JOIN, eliminated N+1 issue. Optimized status filter query using indexed column." }
            ]
          }
        ]
      },
      {
        id: "task2-stage-3",
        name: "代码审查",
        order: 3,
        nodes: [
          {
            id: 9,
            name: "性能优化 Review",
            role: "Reviewer",
            agentType: "CLAUDE",
            agentName: "Code Reviewer",
            status: "DONE",
            duration: 10,
            task: { id: 2, title: "性能优化审查", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "Review database optimization changes." },
              { id: 2, from: "assistant", content: "Review passed. Index usage verified with EXPLAIN analysis. Query execution plans improved significantly." }
            ]
          }
        ]
      },
      {
        id: "task2-stage-4",
        name: "效果验证",
        order: 4,
        nodes: [
          {
            id: 10,
            name: "性能测试",
            role: "测试工程师",
            agentType: "CLAUDE",
            agentName: "Claude Perf",
            status: "IN_PROGRESS",
            task: { id: 2, title: "性能测试", status: "IN_PROGRESS" },
            messages: [
              { id: 1, from: "user", content: "Run performance benchmarks to verify optimization results." },
              { id: 2, from: "assistant", content: "Running performance tests... Initial results show 75% improvement in average query time. Load test in progress with 1000 concurrent users..." }
            ]
          }
        ]
      },
      {
        id: "task2-stage-5",
        name: "发布上线",
        order: 5,
        nodes: [
          {
            id: 11,
            name: "灰度发布",
            role: "DevOps Engineer",
            agentType: "CODEX",
            agentName: "DevOps Deploy",
            status: "PENDING",
            task: { id: 2, title: "灰度发布", status: "TODO" },
            messages: []
          },
          {
            id: 12,
            name: "监控配置",
            role: "DevOps Engineer",
            agentType: "CODEX",
            agentName: "DevOps Monitor",
            status: "PENDING",
            task: { id: 2, title: "监控配置", status: "TODO" },
            messages: []
          }
        ]
      }
    ]
  },

  // ========== 任务 4: 修复分页组件 Bug - Bug 修复流程（含打回） ==========
  // 流程：问题定位 → 代码修复 → 代码 Review(打回→) → 重新修复 → 回归测试 (打回→) → 补充测试 → 发布
  {
    id: 4,
    name: "分页组件 Bug 修复",
    taskId: 4,
    projectId: 1,
    currentNodeId: 16,
    rollbackEdges: [
      // 打回路径：从 Review(41) 打回到代码修复 (15)
      { fromId: 41, toId: 15, reason: "代码规范不通过" },
      // 打回路径：从回归测试 (43) 打回到补充测试 (16)
      { fromId: 43, toId: 16, reason: "测试用例覆盖不足" }
    ],
    stages: [
      {
        id: "task4-stage-1",
        name: "问题定位",
        order: 1,
        nodes: [
          {
            id: 14,
            name: "Bug 复现",
            role: "测试工程师",
            agentType: "CLAUDE",
            agentName: "Claude QA",
            status: "DONE",
            duration: 8,
            task: { id: 4, title: "Bug 复现与分析", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "Reproduce the pagination bug when data is empty." },
              { id: 2, from: "assistant", content: "Bug reproduced: Pagination component shows '0 of 0' and disabled prev/next buttons when data array is empty. Expected: Show 'No data' message." }
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
            status: "DONE",
            duration: 12,
            task: { id: 4, title: "分页组件修复", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "Fix pagination component to handle empty data case properly." },
              { id: 2, from: "assistant", content: "Fixed: Added v-if condition to show 'No data' placeholder when totalCount === 0. Pagination controls hidden for empty state." }
            ]
          }
        ]
      },
      {
        id: "task4-stage-3",
        name: "代码审查",
        order: 3,
        nodes: [
          {
            id: 41,
            name: "代码 Review",
            role: "Reviewer",
            agentType: "CLAUDE",
            agentName: "Code Reviewer",
            status: "REJECTED",
            duration: 6,
            rejectedReason: "代码规范问题",
            task: { id: 4, title: "代码审查", status: "REJECTED" },
            messages: [
              { id: 1, from: "user", content: "Review the pagination fix for code quality and standards." },
              { id: 2, from: "assistant", content: "REJECTED: Code style violations found - missing PropTypes, inconsistent naming (camelCase vs snake_case), and no unit tests. Please fix and resubmit." }
            ]
          }
        ]
      },
      {
        id: "task4-stage-4",
        name: "重新修复",
        order: 4,
        nodes: [
          {
            id: 42,
            name: "规范修正",
            role: "前端开发",
            agentType: "CURSOR",
            agentName: "Cursor Fix",
            status: "DONE",
            duration: 8,
            task: { id: 4, title: "规范修正", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "Fix code style issues: add PropTypes, follow naming convention, add tests." },
              { id: 2, from: "assistant", content: "Fixed: Added PropTypes validation, renamed variables to camelCase, added 5 unit tests covering empty/normal/edge cases." }
            ]
          }
        ]
      },
      {
        id: "task4-stage-5",
        name: "Committer 审批",
        order: 5,
        nodes: [
          {
            id: 45,
            name: "Committer 审批",
            role: "Committer",
            agentType: "CLAUDE",
            agentName: "Code Committer",
            status: "DONE",
            duration: 5,
            task: { id: 4, title: "Committer 审批", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "Approve the pagination fix for merge." },
              { id: 2, from: "assistant", content: "APPROVED: All code standards met, tests passing. Ready to merge into main branch." }
            ]
          }
        ]
      },
      {
        id: "task4-stage-6",
        name: "验证测试",
        order: 6,
        nodes: [
          {
            id: 43,
            name: "回归测试",
            role: "测试工程师",
            agentType: "CLAUDE",
            agentName: "QA Tester",
            status: "REJECTED",
            duration: 10,
            rejectedReason: "测试用例覆盖不足",
            task: { id: 4, title: "回归测试", status: "REJECTED" },
            messages: [
              { id: 1, from: "user", content: "Run regression tests for pagination component." },
              { id: 2, from: "assistant", content: "REJECTED: Test coverage insufficient - missing edge cases for boundary values (page 1, last page) and rapid page switching. Need additional test scenarios." }
            ]
          }
        ]
      },
      {
        id: "task4-stage-7",
        name: "补充测试",
        order: 7,
        nodes: [
          {
            id: 16,
            name: "补充测试",
            role: "测试工程师",
            agentType: "CLAUDE",
            agentName: "Claude Test",
            status: "IN_PROGRESS",
            task: { id: 4, title: "补充测试", status: "IN_PROGRESS" },
            messages: [
              { id: 1, from: "user", content: "Add comprehensive test cases for pagination edge cases." },
              { id: 2, from: "assistant", content: "Adding tests for: boundary pages, rapid switching, page size changes, and empty-to-data transitions. Currently running..." }
            ]
          }
        ]
      },
      {
        id: "task4-stage-8",
        name: "发布上线",
        order: 8,
        nodes: [
          {
            id: 44,
            name: "发布部署",
            role: "DevOps Engineer",
            agentType: "CODEX",
            agentName: "DevOps Deploy",
            status: "PENDING",
            task: { id: 4, title: "发布部署", status: "TODO" },
            messages: []
          }
        ]
      }
    ]
  },

  // ========== 任务 6: 代码重构 - 用户模块重构（含打回） ==========
  // 流程：代码分析 → 并行实施 (服务拆分 + 测试补充) → 重构 Review(打回→) → 完善重构 → 性能验证 → 发布
  {
    id: 6,
    name: "用户模块代码重构",
    taskId: 6,
    projectId: 1,
    currentNodeId: 54,
    rollbackEdges: [
      // 打回路径：从重构 Review(53) 打回到完善重构 (54)
      { fromId: 53, toId: 54, reason: "重构不彻底，遗留技术债务" }
    ],
    stages: [
      {
        id: "task6-stage-1",
        name: "代码分析",
        order: 1,
        nodes: [
          {
            id: 50,
            name: "代码债务分析",
            role: "Tech Lead",
            agentType: "CLAUDE",
            agentName: "Claude Analyst",
            status: "DONE",
            duration: 20,
            task: { id: 6, title: "代码债务分析", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "Analyze user module code debt and identify refactoring opportunities." },
              { id: 2, from: "assistant", content: "Analysis complete: 1) UserService has 800+ lines (SRP violation), 2) Tight coupling with auth logic, 3) Test coverage only 45%. Recommend: Extract AuthService, add integration tests." }
            ]
          }
        ]
      },
      {
        id: "task6-stage-2",
        name: "重构实施",
        order: 2,
        parallel: true,
        parentNode: {
          id: "parent-task6-stage-2",
          name: "重构实施",
          role: "Tech Lead",
          agentType: "CLAUDE",
          agentName: "Claude Lead",
          status: "DONE",
          messages: [
            { id: 1, from: "user", content: "Coordinate parallel refactoring: service extraction and test coverage." },
            { id: 2, from: "assistant", content: "Coordinating parallel tasks: Codex extracting AuthService (35min), Gemini adding tests (30min). Setting up CI pipeline for validation." }
          ]
        },
        nodes: [
          {
            id: 51,
            name: "服务拆分",
            role: "后端开发",
            agentType: "CODEX",
            agentName: "Codex Refactor",
            status: "DONE",
            duration: 35,
            task: { id: 6, title: "服务拆分", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "Extract AuthService from UserService, follow single responsibility principle." },
              { id: 2, from: "assistant", content: "AuthService extracted: login, logout, token refresh moved. UserService now handles only user CRUD. Updated all 12 import references." }
            ]
          },
          {
            id: 52,
            name: "测试补充",
            role: "测试工程师",
            agentType: "GEMINI",
            agentName: "Gemini Test",
            status: "DONE",
            duration: 30,
            task: { id: 6, title: "测试补充", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "Increase test coverage for user module to 80%+." },
              { id: 2, from: "assistant", content: "Added 25 unit tests + 8 integration tests. Coverage increased from 45% to 87%. All tests passing." }
            ]
          }
        ]
      },
      {
        id: "task6-stage-3",
        name: "代码审查",
        order: 3,
        nodes: [
          {
            id: 53,
            name: "重构 Review",
            role: "Committer",
            agentType: "CLAUDE",
            agentName: "Code Committer",
            status: "REJECTED",
            duration: 15,
            rejectedReason: "重构不彻底，遗留技术债务",
            task: { id: 6, title: "重构 Review", status: "REJECTED" },
            messages: [
              { id: 1, from: "user", content: "Review the user module refactoring." },
              { id: 2, from: "assistant", content: "REJECTED: Refactoring incomplete - UserRepository still has business logic, and UserDTO duplication exists. Please consolidate repository layer and remove duplicate DTOs." }
            ]
          }
        ]
      },
      {
        id: "task6-stage-4",
        name: "完善重构",
        order: 4,
        nodes: [
          {
            id: 54,
            name: "完善重构",
            role: "后端开发",
            agentType: "CODEX",
            agentName: "Codex Refactor",
            status: "IN_PROGRESS",
            task: { id: 6, title: "完善重构", status: "IN_PROGRESS" },
            messages: [
              { id: 1, from: "user", content: "Move business logic from UserRepository to Service layer, consolidate DTOs." },
              { id: 2, from: "assistant", content: "Refactoring in progress: Moved validation logic to UserService, removed UserDTO duplication by creating BaseUser DTO. 80% complete..." }
            ]
          }
        ]
      },
      {
        id: "task6-stage-5",
        name: "性能验证",
        order: 5,
        nodes: [
          {
            id: 55,
            name: "性能测试",
            role: "测试工程师",
            agentType: "CLAUDE",
            agentName: "Claude Perf",
            status: "PENDING",
            task: { id: 6, title: "性能测试", status: "TODO" },
            messages: []
          }
        ]
      },
      {
        id: "task6-stage-6",
        name: "发布部署",
        order: 6,
        nodes: [
          {
            id: 56,
            name: "灰度发布",
            role: "DevOps Engineer",
            agentType: "CODEX",
            agentName: "DevOps Deploy",
            status: "PENDING",
            task: { id: 6, title: "灰度发布", status: "TODO" },
            messages: []
          }
        ]
      }
    ]
  },

  // ========== 任务 7: 安全漏洞修复 - 紧急安全流程 ==========
  // 流程：漏洞分析 → XSS 修复 → 渗透测试 (打回→) → 修复优化 → 安全复审 → Committer 审批 → 热修复部署 → 发布验证
  {
    id: 7,
    name: "XSS 漏洞修复",
    taskId: 7,
    projectId: 1,
    currentNodeId: 73,
    rollbackEdges: [
      // 打回路径：从渗透测试 (72) 打回到 XSS 修复 (71)
      { fromId: 72, toId: 71, reason: "修复方案引入新问题" }
    ],
    stages: [
      {
        id: "task7-stage-1",
        name: "漏洞分析",
        order: 1,
        nodes: [
          {
            id: 70,
            name: "安全审计",
            role: "Security Engineer",
            agentType: "CLAUDE",
            agentName: "Claude Security",
            status: "DONE",
            duration: 25,
            task: { id: 7, title: "安全审计", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "Perform security audit for XSS vulnerabilities in user input fields." },
              { id: 2, from: "assistant", content: "Critical XSS found: 1) Comment form doesn't sanitize HTML, 2) User bio field vulnerable to stored XSS, 3) Search query reflected without encoding. CVSS score: 7.5 (High)." }
            ]
          }
        ]
      },
      {
        id: "task7-stage-2",
        name: "漏洞修复",
        order: 2,
        nodes: [
          {
            id: 71,
            name: "XSS 修复",
            role: "前端开发",
            agentType: "CURSOR",
            agentName: "Cursor Security",
            status: "DONE",
            duration: 20,
            task: { id: 7, title: "XSS 修复", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "Fix XSS vulnerabilities with proper input sanitization and output encoding." },
              { id: 2, from: "assistant", content: "Fixed: Added DOMPurify for HTML sanitization, implemented output encoding with vue-escape-html, added CSP headers. All 3 XSS vectors patched." }
            ]
          }
        ]
      },
      {
        id: "task7-stage-3",
        name: "安全验证",
        order: 3,
        nodes: [
          {
            id: 72,
            name: "渗透测试",
            role: "Security Engineer",
            agentType: "CLAUDE",
            agentName: "Claude Pentest",
            status: "REJECTED",
            duration: 30,
            rejectedReason: "修复方案引入新问题",
            task: { id: 7, title: "渗透测试", status: "REJECTED" },
            messages: [
              { id: 1, from: "user", content: "Perform penetration testing to verify XSS fixes." },
              { id: 2, from: "assistant", content: "REJECTED: Fix introduced regression - DOMPurify is too aggressive, stripping legitimate rich text formatting in comments. Need balanced approach with whitelist tags." }
            ]
          }
        ]
      },
      {
        id: "task7-stage-4",
        name: "修复优化",
        order: 4,
        nodes: [
          {
            id: 73,
            name: "修复优化",
            role: "前端开发",
            agentType: "CURSOR",
            agentName: "Cursor Security",
            status: "IN_PROGRESS",
            task: { id: 7, title: "修复优化", status: "IN_PROGRESS" },
            messages: [
              { id: 1, from: "user", content: "Refine XSS fix with tag whitelist to preserve legitimate formatting." },
              { id: 2, from: "assistant", content: "Optimizing: Configured DOMPurify with ALLOWED_TAGS whitelist (b, i, em, code), keeping dangerous tags blocked (script, iframe, object). Testing..." }
            ]
          }
        ]
      },
      {
        id: "task7-stage-5",
        name: "最终验证",
        order: 5,
        nodes: [
          {
            id: 74,
            name: "安全复审",
            role: "Security Engineer",
            agentType: "CLAUDE",
            agentName: "Claude Security",
            status: "PENDING",
            task: { id: 7, title: "安全复审", status: "TODO" },
            messages: []
          },
          {
            id: 75,
            name: "Committer 审批",
            role: "Committer",
            agentType: "CLAUDE",
            agentName: "Code Committer",
            status: "PENDING",
            task: { id: 7, title: "Committer 审批", status: "TODO" },
            messages: []
          }
        ]
      },
      {
        id: "task7-stage-6",
        name: "紧急发布",
        order: 6,
        nodes: [
          {
            id: 76,
            name: "热修复部署",
            role: "DevOps Engineer",
            agentType: "CODEX",
            agentName: "DevOps Hotfix",
            status: "PENDING",
            task: { id: 7, title: "热修复部署", status: "TODO" },
            messages: []
          },
          {
            id: 77,
            name: "发布验证",
            role: "Release Manager",
            agentType: "CLAUDE",
            agentName: "ReleaseMgr",
            status: "PENDING",
            task: { id: 7, title: "发布验证", status: "TODO" },
            messages: []
          }
        ]
      }
    ]
  },

  // ========== 任务 8: 优化页面加载速度 (IN_PROGRESS) - 前端性能优化流程 ==========
  {
    id: 8,
    name: "前端性能优化",
    taskId: 8,
    projectId: 1,
    currentNodeId: 25,
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
              { id: 1, from: "user", content: "Analyze frontend performance bottlenecks using Lighthouse and Chrome DevTools." },
              { id: 2, from: "assistant", content: "Analysis complete: Lighthouse score 62. Issues: 1) Large bundle size (1.2MB), 2) No code splitting, 3) Unoptimized images (450KB), 4) Render-blocking CSS. FCP: 3.2s, LCP: 4.1s." }
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
          role: "Tech Lead",
          agentType: "CLAUDE",
          agentName: "Claude Lead",
          status: "DONE",
          messages: [
            { id: 1, from: "user", content: "Implement performance optimizations in parallel tasks." },
            { id: 2, from: "assistant", content: "Coordinating parallel optimizations: Cursor implementing code splitting, Gemini optimizing assets. Target: Lighthouse score 90+." }
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
              { id: 1, from: "user", content: "Implement route-based code splitting with dynamic imports." },
              { id: 2, from: "assistant", content: "Code splitting done: Split vendor chunks, lazy-loaded routes (Admin, Dashboard, Settings). Bundle reduced from 1.2MB to 380KB initial load." }
            ]
          },
          {
            id: 23,
            name: "资源优化",
            role: "前端开发",
            agentType: "GEMINI",
            agentName: "Gemini Assets",
            status: "DONE",
            duration: 20,
            task: { id: 8, title: "资源加载优化", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "Optimize images and implement lazy loading for assets." },
              { id: 2, from: "assistant", content: "Optimizing: Converted images to WebP (60% smaller), added lazy loading with IntersectionObserver, preloaded critical CSS. Progress: 100% complete." }
            ]
          }
        ]
      },
      {
        id: "task8-stage-3",
        name: "代码审查",
        order: 3,
        nodes: [
          {
            id: 24,
            name: "性能优化 Review",
            role: "Reviewer",
            agentType: "CLAUDE",
            agentName: "Code Reviewer",
            status: "DONE",
            duration: 8,
            task: { id: 8, title: "性能优化审查", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "Review performance optimization changes." },
              { id: 2, from: "assistant", content: "Review passed. Code splitting correctly implemented, image optimization verified. No regressions detected." }
            ]
          }
        ]
      },
      {
        id: "task8-stage-4",
        name: "效果验证",
        order: 4,
        nodes: [
          {
            id: 25,
            name: "性能测试",
            role: "测试工程师",
            agentType: "CLAUDE",
            agentName: "Claude Perf",
            status: "IN_PROGRESS",
            task: { id: 8, title: "性能回归测试", status: "IN_PROGRESS" },
            messages: [
              { id: 1, from: "user", content: "Run Lighthouse and performance benchmarks after optimizations." },
              { id: 2, from: "assistant", content: "Running tests... Initial results: Lighthouse score improved from 62 to 88! FCP: 1.2s (-62%), LCP: 1.8s (-56%). Finalizing report..." }
            ]
          }
        ]
      },
      {
        id: "task8-stage-5",
        name: "发布上线",
        order: 5,
        nodes: [
          {
            id: 26,
            name: "灰度发布",
            role: "DevOps Engineer",
            agentType: "CODEX",
            agentName: "DevOps Deploy",
            status: "PENDING",
            task: { id: 8, title: "灰度发布", status: "TODO" },
            messages: []
          },
          {
            id: 27,
            name: "监控配置",
            role: "DevOps Engineer",
            agentType: "CODEX",
            agentName: "DevOps Monitor",
            status: "PENDING",
            task: { id: 8, title: "性能监控配置", status: "TODO" },
            messages: []
          }
        ]
      }
    ]
  },

  // ========== 任务 3: 添加任务导出功能 (TODO) - 功能开发流程 ==========
  {
    id: 3,
    name: "任务导出功能开发",
    taskId: 3,
    projectId: 1,
    currentNodeId: 35,
    stages: [
      {
        id: "task3-stage-1",
        name: "需求分析",
        order: 1,
        nodes: [
          {
            id: 31,
            name: "导出方案设计",
            role: "产品经理",
            agentType: "CLAUDE",
            agentName: "Claude PM",
            status: "DONE",
            duration: 15,
            task: { id: 3, title: "导出功能需求分析", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "Define requirements for task export feature." },
              { id: 2, from: "assistant", content: "Requirements defined: 1) Export to Excel (.xlsx) and PDF formats, 2) Support filtering by project, status, assignee, 3) Include task details: title, description, status, assignee, due date, 4) Support bulk export up to 1000 tasks." }
            ]
          }
        ]
      },
      {
        id: "task3-stage-2",
        name: "API 设计",
        order: 2,
        nodes: [
          {
            id: 32,
            name: "API 接口设计",
            role: "架构师",
            agentType: "CLAUDE",
            agentName: "Claude Architect",
            status: "DONE",
            duration: 12,
            task: { id: 3, title: "API 接口设计", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "Design REST API for task export." },
              { id: 2, from: "assistant", content: "API designed: GET /api/tasks/export?format=xlsx|pdf&projectId=&status=&assignee=. Returns file stream with appropriate Content-Type and Content-Disposition headers." }
            ]
          }
        ]
      },
      {
        id: "task3-stage-3",
        name: "开发实施",
        order: 3,
        parallel: true,
        parentNode: {
          id: "parent-task3-stage-3",
          name: "开发实施",
          role: "Tech Lead",
          agentType: "CLAUDE",
          agentName: "Claude Lead",
          status: "IN_PROGRESS",
          messages: [
            { id: 1, from: "user", content: "Coordinate parallel development of Excel and PDF export." },
            { id: 2, from: "assistant", content: "Coordinating export implementation: Codex implementing Excel export with Apache POI, Gemini implementing PDF export with iText. Both using async job queue for large exports." }
          ]
        },
        nodes: [
          {
            id: 33,
            name: "Excel 导出",
            role: "后端开发",
            agentType: "CODEX",
            agentName: "Codex Export",
            status: "DONE",
            duration: 25,
            task: { id: 3, title: "Excel 导出功能", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "Implement Excel export with Apache POI." },
              { id: 2, from: "assistant", content: "Excel export implemented. Created XLSX format with styled headers, auto-width columns, and filters. Supports up to 1000 tasks with progress indicator." }
            ]
          },
          {
            id: 34,
            name: "PDF 导出",
            role: "后端开发",
            agentType: "GEMINI",
            agentName: "Gemini PDF",
            status: "IN_PROGRESS",
            task: { id: 3, title: "PDF 导出功能", status: "IN_PROGRESS" },
            messages: [
              { id: 1, from: "user", content: "Implement PDF export with iText library." },
              { id: 2, from: "assistant", content: "PDF export in progress: Created table layout with proper page breaks, added header with export timestamp. Currently optimizing for large datasets..." }
            ]
          }
        ]
      },
      {
        id: "task3-stage-4",
        name: "前端开发",
        order: 4,
        nodes: [
          {
            id: 35,
            name: "导出按钮 UI",
            role: "前端开发",
            agentType: "CURSOR",
            agentName: "Cursor Frontend",
            status: "PENDING",
            task: { id: 3, title: "导出按钮 UI", status: "TODO" },
            messages: []
          }
        ]
      },
      {
        id: "task3-stage-5",
        name: "测试验证",
        order: 5,
        nodes: [
          {
            id: 36,
            name: "功能测试",
            role: "测试工程师",
            agentType: "CLAUDE",
            agentName: "Claude QA",
            status: "PENDING",
            task: { id: 3, title: "导出功能测试", status: "TODO" },
            messages: []
          }
        ]
      }
    ]
  },

  // ========== 任务 5: 集成消息通知服务 (IN_PROGRESS) - 第三方集成流程 ==========
  {
    id: 5,
    name: "消息通知集成",
    taskId: 5,
    projectId: 1,
    currentNodeId: 55,
    stages: [
      {
        id: "task5-stage-1",
        name: "方案调研",
        order: 1,
        nodes: [
          {
            id: 51,
            name: "通知服务调研",
            role: "架构师",
            agentType: "CLAUDE",
            agentName: "Claude Architect",
            status: "DONE",
            duration: 20,
            task: { id: 5, title: "通知服务技术选型", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "Research notification services for team collaboration." },
              { id: 2, from: "assistant", content: "Research complete: Recommend enterprise WeChat (企业微信) and DingTalk (钉钉) for Chinese market. Both support webhook bots, markdown messages, and @mentions. Integration complexity: low." }
            ]
          }
        ]
      },
      {
        id: "task5-stage-2",
        name: "API 设计",
        order: 2,
        nodes: [
          {
            id: 52,
            name: "通知 API 设计",
            role: "架构师",
            agentType: "CLAUDE",
            agentName: "Claude Architect",
            status: "DONE",
            duration: 10,
            task: { id: 5, title: "通知 API 设计", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "Design unified notification API." },
              { id: 2, from: "assistant", content: "API designed: POST /api/notifications/send with provider (wechat|dingtalk), messageType (text|markdown|news), receivers, content. Adapter pattern for provider-specific implementations." }
            ]
          }
        ]
      },
      {
        id: "task5-stage-3",
        name: "集成开发",
        order: 3,
        parallel: true,
        parentNode: {
          id: "parent-task5-stage-3",
          name: "集成开发",
          role: "Tech Lead",
          agentType: "CLAUDE",
          agentName: "Claude Lead",
          status: "IN_PROGRESS",
          messages: [
            { id: 1, from: "user", content: "Coordinate parallel integration of WeChat and DingTalk." },
            { id: 2, from: "assistant", content: "Coordinating integrations: Codex implementing WeChat bot, Gemini implementing DingTalk bot. Both using async queue for reliable delivery." }
          ]
        },
        nodes: [
          {
            id: 53,
            name: "企业微信集成",
            role: "后端开发",
            agentType: "CODEX",
            agentName: "Codex WeChat",
            status: "DONE",
            duration: 20,
            task: { id: 5, title: "企业微信机器人集成", status: "DONE" },
            messages: [
              { id: 1, from: "user", content: "Implement enterprise WeChat webhook bot integration." },
              { id: 2, from: "assistant", content: "WeChat integration complete: Implemented text and markdown message types, added @mention support, configured webhook URL management in admin panel." }
            ]
          },
          {
            id: 54,
            name: "钉钉集成",
            role: "后端开发",
            agentType: "GEMINI",
            agentName: "Gemini DingTalk",
            status: "IN_PROGRESS",
            task: { id: 5, title: "钉钉机器人集成", status: "IN_PROGRESS" },
            messages: [
              { id: 1, from: "user", content: "Implement DingTalk webhook bot integration." },
              { id: 2, from: "assistant", content: "DingTalk integration in progress: Implemented text and markdown messages, currently adding action card (interactive button) support. HMAC-SHA256 signature verification added." }
            ]
          }
        ]
      },
      {
        id: "task5-stage-4",
        name: "通知模板",
        order: 4,
        nodes: [
          {
            id: 55,
            name: "模板配置功能",
            role: "前端开发",
            agentType: "CURSOR",
            agentName: "Cursor Frontend",
            status: "PENDING",
            task: { id: 5, title: "通知模板配置", status: "TODO" },
            messages: []
          }
        ]
      },
      {
        id: "task5-stage-5",
        name: "测试上线",
        order: 5,
        nodes: [
          {
            id: 56,
            name: "集成测试",
            role: "测试工程师",
            agentType: "CLAUDE",
            agentName: "Claude QA",
            status: "PENDING",
            task: { id: 5, title: "通知功能测试", status: "TODO" },
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

// 获取指定项目的 workflow（返回第一个匹配的）
export function getWorkflowByProject(projectId) {
  return mockWorkflows.find(w => w.projectId === projectId)
}

// 获取指定任务的 workflow
export function getWorkflowByTask(taskId) {
  return mockWorkflows.find(w => w.taskId === taskId)
}

// 获取指定 workflow
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

// 获取工作流的回滚边
export function getRollbackEdges(workflow) {
  return workflow?.rollbackEdges || []
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
 * @param {string} status - New status ('PENDING', 'IN_PROGRESS', 'DONE', 'FAILED', 'REJECTED')
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
 * Set rejected reason for a node
 * @param {number|string} workflowId - Workflow ID
 * @param {number|string} nodeId - Node ID
 * @param {string} reason - Rejected reason
 * @returns {boolean} Success status
 */
export function setNodeRejectedReason(workflowId, nodeId, reason) {
  const workflow = getWorkflowById(workflowId)
  if (!workflow) return false

  const node = getAllNodes(workflow).find(n => n.id === nodeId)
  if (!node) return false

  node.rejectedReason = reason
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
