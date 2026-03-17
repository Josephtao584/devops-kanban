# DevOps Kanban Backend (Python/FastAPI)

Python 后端实现，使用本地 JSON 文件存储，提供项目管理、需求管理、任务管理和角色管理的 RESTful API。

## 技术栈

- **框架**: FastAPI 0.115
- **数据存储**: JSON 文件
- **数据验证**: Pydantic v2

## 快速开始

### 1. 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

### 2. 启动服务

```bash
# 开发模式（自动重载）
./start.sh

# 或者
python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 或者
python3 main.py
```

### 3. 访问 API 文档

启动后访问：
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## 项目结构

```
backend/
├── main.py                 # FastAPI 应用入口
├── config.py               # 配置管理
├── storage.py              # 文件存储基类
├── enums.py                # 枚举类型定义
├── requirements.txt        # Python 依赖
├── .env.example            # 环境变量示例
├── data/                   # JSON 数据文件（链接到项目根目录 data/）
│   ├── projects.json
│   ├── requirements.json
│   ├── tasks.json
│   └── roles.json
├── schemas/                # Pydantic schemas
│   ├── project.py
│   ├── requirement.py
│   ├── task.py
│   └── role.py
├── routes/                 # API 路由
│   ├── projects.py
│   ├── requirements.py
│   ├── tasks.py
│   └── roles.py
└── repositories/           # 文件仓库
    ├── projects.py
    ├── requirements.py
    ├── tasks.py
    └── roles.py
```

## API 端点

### Projects (项目管理)
| 方法 | 端点 | 描述 |
|------|------|------|
| GET | /api/projects | 获取所有项目 |
| GET | /api/projects/{id} | 获取项目详情 |
| POST | /api/projects | 创建项目 |
| PUT | /api/projects/{id} | 更新项目 |
| DELETE | /api/projects/{id} | 删除项目 |

### Requirements (需求管理)
| 方法 | 端点 | 描述 |
|------|------|------|
| GET | /api/requirements?projectId={id} | 获取需求列表 |
| GET | /api/requirements/{id} | 获取需求详情 |
| POST | /api/requirements | 创建需求 |
| PUT | /api/requirements/{id} | 更新需求 |
| DELETE | /api/requirements/{id} | 删除需求 |

### Tasks (任务管理)
| 方法 | 端点 | 描述 |
|------|------|------|
| GET | /api/tasks?projectId={id} | 获取任务列表 |
| GET | /api/tasks/{id} | 获取任务详情 |
| POST | /api/tasks | 创建任务 |
| PUT | /api/tasks/{id} | 更新任务 |
| PATCH | /api/tasks/{id}/status | 更新任务状态 |
| DELETE | /api/tasks/{id} | 删除任务 |

### Roles (角色管理)
| 方法 | 端点 | 描述 |
|------|------|------|
| GET | /api/roles?projectId={id} | 获取角色列表 |
| GET | /api/roles/{id} | 获取角色详情 |
| POST | /api/roles | 创建角色 |
| PUT | /api/roles/{id} | 更新角色 |
| DELETE | /api/roles/{id} | 删除角色 |

## 响应格式

所有 API 响应统一格式：

```json
{
    "success": true,
    "message": "Success",
    "data": { ... },
    "error": null
}
```

错误响应：

```json
{
    "success": false,
    "message": "Error message",
    "data": null,
    "error": "Detailed error"
}
```

## 配置

复制 `.env.example` 到 `.env` 并修改配置：

```env
# 数据存储路径
DATA_PATH=../data

# 服务器配置
HOST=0.0.0.0
PORT=8000

# CORS 配置
CORS_ORIGINS=["http://localhost:5173","http://localhost:3000"]
```

## 数据模型

### Project (项目)
```json
{
    "id": 1,
    "name": "项目名称",
    "description": "项目描述",
    "repository_url": "https://github.com/...",
    "local_path": "/path/to/repo",
    "created_at": "2026-03-17T03:00:00",
    "updated_at": "2026-03-17T03:00:00"
}
```

### Requirement (需求)
```json
{
    "id": 1,
    "project_id": 1,
    "title": "需求标题",
    "description": "需求描述",
    "status": "DRAFT",  // DRAFT, ANALYZING, APPROVED, REJECTED
    "priority": "MEDIUM",  // LOW, MEDIUM, HIGH, CRITICAL
    "acceptance_criteria": "验收标准",
    "created_by": "用户名",
    "created_at": "2026-03-17T03:00:00",
    "updated_at": "2026-03-17T03:00:00"
}
```

### Task (任务)
```json
{
    "id": 1,
    "project_id": 1,
    "requirement_id": null,
    "title": "任务标题",
    "description": "任务描述",
    "status": "TODO",  // TODO, IN_PROGRESS, BLOCKED, DONE
    "priority": "HIGH",  // LOW, MEDIUM, HIGH, CRITICAL
    "assignee": "负责人",
    "created_at": "2026-03-17T03:00:00",
    "updated_at": "2026-03-17T03:00:00"
}
```

### Role (角色)
```json
{
    "id": 1,
    "project_id": 1,
    "name": "角色名称",
    "description": "角色描述",
    "permissions": ["read", "write"],
    "created_at": "2026-03-17T03:00:00",
    "updated_at": "2026-03-17T03:00:00"
}
```

## 与前端集成

前端需要配置 API 代理到 Python 后端：

```javascript
// frontend/vite.config.js
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  }
})
```

## 测试 API

```bash
# 获取所有项目
curl http://localhost:8000/api/projects

# 创建项目
curl -X POST http://localhost:8000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "测试项目", "description": "一个测试项目"}'

# 获取任务列表
curl "http://localhost:8000/api/tasks?projectId=1"

# 更新任务状态
curl -X PATCH http://localhost:8000/api/tasks/1/status \
  -H "Content-Type: application/json" \
  -d '{"status": "IN_PROGRESS"}'

# 创建需求
curl -X POST http://localhost:8000/api/requirements \
  -H "Content-Type: application/json" \
  -d '{"project_id": 1, "title": "需求标题", "description": "需求描述"}'
```

## 数据存储

数据以 JSON 文件形式存储在 `data/` 目录下（项目根目录）：
- `projects.json` - 项目数据
- `requirements.json` - 需求数据
- `tasks.json` - 任务数据
- `roles.json` - 角色数据

所有文件使用 UTF-8 编码，支持中文。
