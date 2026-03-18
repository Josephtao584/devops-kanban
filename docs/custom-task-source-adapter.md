# 自定义任务源适配器开发指南

本文档说明如何为 DevOps Kanban 开发自定义任务源适配器，接入您自己的任务管理系统（如 GitLab、Jira、Trello 等）。

## 架构概述

任务源系统采用适配器模式（Adapter Pattern），通过 SPI（Service Provider Interface）机制动态加载适配器。

```
┌─────────────────────────────────────────────────────────────┐
│                     TaskSourceService                        │
│  (taskSourceService.js - 业务逻辑层)                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Adapter Registry                          │
│  (adapters/index.js - 适配器注册中心)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ GITHUB   │  │ GITLAB   │  │ 自定义    │  ← 可扩展        │
│  │ Adapter  │  │ Adapter  │  │ Adapter  │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 外部任务管理系统                               │
│  (GitHub / GitLab / Jira / Trello / 自建系统)               │
└─────────────────────────────────────────────────────────────┘
```

## 开发步骤

### 1. 创建适配器文件

在 `backend/src/adapters/` 目录下创建新的适配器文件，例如 `jira.js`。

### 2. 继承基础适配器类

```javascript
const { TaskSourceAdapter } = require('./base');

class JiraAdapter extends TaskSourceAdapter {
  constructor(source) {
    super(source);
    // 从 source.config 中获取配置
    this.baseUrl = source.config?.baseUrl;
    this.email = source.config?.email;
    this.apiToken = source.config?.apiToken;
    this.projectKey = source.config?.projectKey;
  }

  // 实现方法...
}
```

### 3. 实现必需的方法

您的适配器必须实现以下方法：

#### 3.1 fetch() - 获取任务列表

```javascript
async fetch() {
  // 调用外部 API 获取任务
  const issues = await this._request('/rest/api/3/search');

  // 转换为统一格式并返回
  return issues.map((issue) => this.convertToTask(issue));
}
```

#### 3.2 testConnection() - 测试连接

```javascript
async testConnection() {
  try {
    await this._request('/rest/api/3/myself');
    return true;
  } catch (error) {
    return false;
  }
}
```

#### 3.3 convertToTask() - 转换任务格式

```javascript
convertToTask(issue) {
  return {
    title: issue.summary,                    // 标题（必需）
    description: issue.description?.content?.[0]?.content?.[0]?.text || '', // 描述
    external_id: issue.key,                   // 外部ID（必需，用于去重）
    external_url: `${this.baseUrl}/browse/${issue.key}`, // 外部链接
    status: this._mapStatus(issue.status?.name), // 状态映射
    labels: issue.labels || [],               // 标签
    created_at: issue.created,                // 创建时间
    updated_at: issue.updated,                // 更新时间
  };
}
```

### 4. 定义静态元数据

元数据用于前端显示配置表单：

```javascript
static metadata = {
  name: 'Jira',
  description: '从 Jira 同步任务',
  config: {
    baseUrl: {
      type: 'string',
      required: true,
      description: 'Jira 实例地址（如 https://your-domain.atlassian.net）',
    },
    email: {
      type: 'string',
      required: true,
      description: '您的 Jira 邮箱',
    },
    apiToken: {
      type: 'string',
      required: true,
      description: 'Jira API Token（在 https://id.atlassian.com/manage-profile/security/api-tokens 生成）',
    },
    projectKey: {
      type: 'string',
      required: false,
      description: '项目 Key（留空则同步所有项目）',
    },
  },
};
```

支持的配置字段类型：
- `string`: 文本输入
- `password`: 密码输入
- `number`: 数字输入
- `boolean`: 布尔开关
- `array`: 数组输入

### 5. 注册适配器

编辑 `backend/src/adapters/index.js`，注册您的适配器：

```javascript
const { GitHubAdapter } = require('./github')
const { JiraAdapter } = require('./jira')  // 添加这一行

// ... registerAdapter 调用 ...

registerAdapter('GITHUB', GitHubAdapter)
registerAdapter('JIRA', JiraAdapter)  // 注册新适配器
```

## 任务数据格式规范

适配器返回的任务对象必须包含以下字段：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `title` | string | 是 | 任务标题 |
| `description` | string | 否 | 任务描述 |
| `external_id` | string | 是 | 外部系统唯一ID（用于去重） |
| `external_url` | string | 否 | 外部任务链接 |
| `status` | string | 否 | 状态（TODO / IN_PROGRESS / DONE） |
| `labels` | string[] | 否 | 标签数组 |
| `priority` | string | 否 | 优先级（LOW / MEDIUM / HIGH / URGENT） |
| `created_at` | string | 否 | ISO 8601 格式时间 |
| `updated_at` | string | 否 | ISO 8601 格式时间 |

## 完整示例：GitLab 适配器

```javascript
const { TaskSourceAdapter } = require('./base');
const https = require('https');

class GitLabAdapter extends TaskSourceAdapter {
  constructor(source) {
    super(source);
    this.baseUrl = source.config?.baseUrl || 'https://gitlab.com';
    this.token = source.config?.token;
    this.projectId = source.config?.projectId;
  }

  static metadata = {
    name: 'GitLab Issues',
    description: '从 GitLab Issues 同步任务',
    config: {
      baseUrl: {
        type: 'string',
        required: false,
        description: 'GitLab 实例地址（默认使用 gitlab.com）',
      },
      token: {
        type: 'string',
        required: true,
        description: 'GitLab Personal Access Token',
      },
      projectId: {
        type: 'string',
        required: true,
        description: '项目 ID 或路径（owner/project）',
      },
    },
  };

  _request(path) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        headers: {
          'PRIVATE-TOKEN': this.token,
          'User-Agent': 'DevOps-Kanban-App',
        },
        method: 'GET',
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`GitLab API error: ${res.statusCode}`));
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  async fetch() {
    const projectPath = encodeURIComponent(this.projectId);
    const issues = await this._request(`/api/v4/projects/${projectPath}/issues`);
    return issues.map((issue) => this.convertToTask(issue));
  }

  async testConnection() {
    try {
      const projectPath = encodeURIComponent(this.projectId);
      await this._request(`/api/v4/projects/${projectPath}`);
      return true;
    } catch {
      return false;
    }
  }

  convertToTask(issue) {
    return {
      title: issue.title,
      description: issue.description || '',
      external_id: issue.id.toString(),
      external_url: issue.web_url,
      status: issue.state === 'opened' ? 'TODO' : 'DONE',
      labels: issue.labels || [],
      created_at: issue.created_at,
      updated_at: issue.updated_at,
    };
  }
}

module.exports = { GitLabAdapter };
```

## 测试您的适配器

1. 重启后端服务：
   ```bash
   cd backend && npm run dev
   ```

2. 查看可用任务源类型：
   ```bash
   curl http://localhost:8000/api/task-sources/types/available
   ```

3. 创建任务源配置：
   ```bash
   curl -X POST http://localhost:8000/api/task-sources \
     -H "Content-Type: application/json" \
     -d '{
       "type": "JIRA",
       "name": "我的 Jira",
       "project_id": 1,
       "config": {
         "baseUrl": "https://your-domain.atlassian.net",
         "email": "your@email.com",
         "apiToken": "your-api-token",
         "projectKey": "YOURPROJECT"
       }
     }'
   ```

4. 测试连接：
   ```bash
   curl http://localhost:8000/api/task-sources/{id}/test
   ```

5. 预览同步：
   ```bash
   curl -X POST http://localhost:8000/api/task-sources/{id}/sync/preview
   ```

## 注意事项

1. **错误处理**：请确保妥善处理网络错误和 API 限流，返回有意义的错误信息。

2. **安全性**：敏感信息（如 API Token）只存储在后端，不发送到前端。

3. **分页处理**：如果外部系统有大量任务，请考虑实现分页逻辑。

4. **字段映射**：不同系统的状态、优先级等字段值不同，请在 `convertToTask` 中进行映射。

5. **缓存策略**：如果需要，可以实现本地缓存减少 API 调用。

## 常见问题

**Q: 如何处理私有证书？**
A: 在 `_request` 方法中使用自定义 Agent 配置 `rejectUnauthorized: false`（仅开发环境）。

**Q: 如何支持 Webhook 实时同步？**
A: 需要在适配器中实现 Webhook 端点，并在外部系统中配置 Webhook URL。

**Q: 如何处理自定义字段？**
A: 在 `convertToTask` 方法中将自定义字段添加到返回对象中，系统会存储在 `labels` 或额外字段中。