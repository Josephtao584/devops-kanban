# Python 后端快速启动指南

## 概述

本项目包含两个后端实现：
- **Java Spring Boot** (原有，端口 8080) - 完整功能包括 Git Worktree 和 AI Agent
- **Python FastAPI** (新增，端口 8000) - 基础 CRUD 功能，简化的实现

## 启动 Python 后端

### 方法 1: 使用启动脚本（推荐）

```bash
cd backend
./start.sh
```

### 方法 2: 使用 uvicorn 直接启动

```bash
cd backend
python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 方法 3: 使用 Python 直接启动

```bash
cd backend
python3 main.py
```

## 配置前端连接到 Python 后端

修改 `frontend/vite.config.js`，将代理目标从 8080 改为 8000：

```javascript
proxy: {
  '/api': {
    target: 'http://localhost:8000',  // 原来是 8080
    changeOrigin: true
  },
  '/ws': {
    target: 'http://localhost:8000',  // 原来是 8080
    changeOrigin: true,
    ws: true
  }
}
```

然后重启前端开发服务器：

```bash
cd frontend
npm run dev
```

## API 文档

启动 Python 后端后，访问以下地址查看 API 文档：
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

## 功能对比

| 功能 | Java Spring Boot | Python FastAPI |
|------|------------------|----------------|
| 项目管理 | ✅ | ✅ |
| 需求管理 | ❌ | ✅ |
| 任务管理 | ✅ | ✅ |
| 角色管理 | ❌ | ✅ |
| Git Worktree | ✅ | ❌ |
| AI Agent 执行 | ✅ | ❌ |
| WebSocket 会话 | ✅ | ❌ |
| 相位转换 | ✅ | ❌ |

## 数据存储

Python 后端使用本地 JSON 文件存储数据，文件位于：
- `backend/data/projects.json` - 项目数据
- `backend/data/requirements.json` - 需求数据
- `backend/data/tasks.json` - 任务数据
- `backend/data/roles.json` - 角色数据

所有文件使用 UTF-8 编码，支持中文。

## 测试 API

```bash
# 获取所有项目
curl http://localhost:8000/api/projects

# 创建项目
curl -X POST http://localhost:8000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "My Project", "description": "Test"}'

# 获取任务列表
curl "http://localhost:8000/api/tasks?projectId=1"

# 更新任务状态
curl -X PATCH http://localhost:8000/api/tasks/1/status \
  -H "Content-Type: application/json" \
  -d '{"status": "IN_PROGRESS"}'
```

## 切换回 Java 后端

如需切换回 Java 后端：
1. 停止 Python 后端 (`pkill -f "uvicorn main:app"`)
2. 修改 `frontend/vite.config.js` 将代理目标改回 `http://localhost:8080`
3. 重启前端和 Java 后端

```bash
# 启动 Java 后端
mvn spring-boot:run
```

## 注意事项

1. **数据不互通**: Java 和 Python 后端使用不同的数据存储（Java 用 JSON 文件在 `data/` 目录，Python 用 JSON 文件在 `backend/data/` 目录）
2. **端口冲突**: 确保两个后端不会同时运行
3. **功能限制**: Python 后端是简化版本，不包含 Git Worktree 和 AI Agent 等高级功能
