# DevOps Kanban 冒烟测试清单

## 一、环境启动测试

| ID | 测试项 | 验证点 | 优先级 |
|----|--------|--------|--------|
| ENV-01 | 后端服务启动 | `mvn spring-boot:run` 成功，端口 8080 可访问 | P0 |
| ENV-02 | 前端服务启动 | `npm run dev` 成功，端口 5173 可访问 | P0 |
| ENV-03 | 健康检查 | 后端 `/api/projects` 返回 200 或空列表 | P0 |

---

## 二、项目管理 API 测试

| ID | 测试项 | 操作 | 验证点 | 优先级 |
|----|--------|------|--------|--------|
| PROJ-01 | 获取项目列表 | `GET /api/projects` | 返回 200，JSON 格式正确 | P0 |
| PROJ-02 | 创建项目 | `POST /api/projects` | 返回 201，项目 ID 生成 | P0 |
| PROJ-03 | 获取单个项目 | `GET /api/projects/{id}` | 返回 200，数据一致 | P1 |
| PROJ-04 | 更新项目 | `PUT /api/projects/{id}` | 返回 200，更新生效 | P1 |
| PROJ-05 | 删除项目 | `DELETE /api/projects/{id}` | 返回 204 | P1 |
| PROJ-06 | 创建项目-缺少必填项 | `POST /api/projects` (空 name) | 返回 400 错误 | P2 |

---

## 三、任务管理 API 测试

| ID | 测试项 | 操作 | 验证点 | 优先级 |
|----|--------|------|--------|--------|
| TASK-01 | 获取任务列表 | `GET /api/tasks?projectId={id}` | 返回 200，JSON 格式正确 | P0 |
| TASK-02 | 创建任务 | `POST /api/tasks` | 返回 201，任务 ID 生成 | P0 |
| TASK-03 | 获取单个任务 | `GET /api/tasks/{id}` | 返回 200，数据一致 | P1 |
| TASK-04 | 更新任务 | `PUT /api/tasks/{id}` | 返回 200，更新生效 | P1 |
| TASK-05 | 更新任务状态 | `PATCH /api/tasks/{id}/status` | 状态正确变更 (TODO→IN_PROGRESS) | P0 |
| TASK-06 | 删除任务 | `DELETE /api/tasks/{id}` | 返回 204 | P1 |
| TASK-07 | 任务状态流转 | 状态: TODO→IN_PROGRESS→DONE | 状态流转正确 | P1 |
| TASK-08 | 任务按状态筛选 | `GET /api/tasks?projectId={id}&status=TODO` | 返回正确筛选结果 | P2 |

---

## 四、任务源 API 测试

| ID | 测试项 | 操作 | 验证点 | 优先级 |
|----|--------|------|--------|--------|
| SRC-01 | 获取任务源列表 | `GET /api/task-sources?projectId={id}` | 返回 200 | P1 |
| SRC-02 | 创建任务源 | `POST /api/task-sources` | 返回 201 | P1 |
| SRC-03 | 获取单个任务源 | `GET /api/task-sources/{id}` | 返回 200 | P2 |
| SRC-04 | 更新任务源 | `PUT /api/task-sources/{id}` | 返回 200 | P2 |
| SRC-05 | 删除任务源 | `DELETE /api/task-sources/{id}` | 返回 204 | P2 |
| SRC-06 | 测试连接 | `GET /api/task-sources/{id}/test` | 返回连接测试结果 | P2 |
| SRC-07 | 同步任务 | `POST /api/task-sources/{id}/sync` | 返回 202，触发同步 | P2 |

---

## 五、AI 代理 API 测试

| ID | 测试项 | 操作 | 验证点 | 优先级 |
|----|--------|------|--------|--------|
| AGT-01 | 获取代理列表 | `GET /api/agents?projectId={id}` | 返回 200 | P1 |
| AGT-02 | 创建代理 | `POST /api/agents` | 返回 201 | P1 |
| AGT-03 | 获取单个代理 | `GET /api/agents/{id}` | 返回 200 | P2 |
| AGT-04 | 更新代理 | `PUT /api/agents/{id}` | 返回 200 | P2 |
| AGT-05 | 删除代理 | `DELETE /api/agents/{id}` | 返回 204 | P2 |

---

## 六、执行管理 API 测试

| ID | 测试项 | 操作 | 验证点 | 优先级 |
|----|--------|------|--------|--------|
| EXEC-01 | 启动执行 | `POST /api/executions` | 返回 202，执行 ID 生成 | P0 |
| EXEC-02 | 获取执行状态 | `GET /api/executions/{id}` | 返回执行详情 | P0 |
| EXEC-03 | 获取任务执行列表 | `GET /api/executions?taskId={id}` | 返回该任务的执行记录 | P1 |
| EXEC-04 | 停止执行 | `POST /api/executions/{id}/stop` | 返回 202，状态变为 CANCELLED | P1 |
| EXEC-05 | 实时输出流 | `GET /api/executions/{id}/output` (SSE) | 返回 text/event-stream | P1 |

---

## 七、Git API 测试

| ID | 测试项 | 操作 | 验证点 | 优先级 |
|----|--------|------|--------|--------|
| GIT-01 | 获取 Diff | `GET /api/git/diff` | 返回 diff 内容 | P1 |
| GIT-02 | 创建 Worktree | Worktree 创建和清理 | 正常创建和删除 | P1 |

---

## 八、前端页面测试

| ID | 测试项 | 操作 | 验证点 | 优先级 |
|----|--------|------|--------|--------|
| UI-01 | 项目列表页 | 访问 `/` | 页面正常渲染，显示项目列表 | P0 |
| UI-02 | 创建项目 | 点击创建按钮，填写表单 | 项目创建成功，列表刷新 | P0 |
| UI-03 | 看板页面 | 访问 `/kanban/{projectId}` | 任务卡片按状态列显示 | P0 |
| UI-04 | 创建任务 | 看板页创建任务 | 任务出现在对应列 | P0 |
| UI-05 | 拖拽任务 | 拖拽任务卡片到其他列 | 状态更新成功 | P1 |
| UI-06 | 任务详情 | 点击任务卡片 | 弹出详情对话框 | P1 |
| UI-07 | 任务源配置页 | 访问 `/task-sources/{projectId}` | 页面正常渲染 | P1 |
| UI-08 | 代理配置页 | 访问 `/agents/{projectId}` | 页面正常渲染 | P1 |
| UI-09 | Diff 查看器 | 查看任务执行 diff | 正确显示代码变更 | P2 |

---

## 九、集成流程测试

| ID | 测试项 | 操作流程 | 验证点 | 优先级 |
|----|--------|----------|--------|--------|
| INT-01 | 完整任务流程 | 创建项目→创建任务→创建代理→执行任务 | 流程完整可用 | P0 |
| INT-02 | 任务源同步 | 创建任务源→同步→查看导入的任务 | 任务正确导入 | P1 |
| INT-03 | 数据持久化 | 创建数据→重启服务→验证数据存在 | 数据正确持久化到 JSON 文件 | P1 |

---

## 十、边界与异常测试

| ID | 测试项 | 操作 | 验证点 | 优先级 |
|----|--------|------|--------|--------|
| ERR-01 | 访问不存在的资源 | `GET /api/tasks/non-existent-id` | 返回 404 | P1 |
| ERR-02 | 无效状态值 | `PATCH /api/tasks/{id}/status` (无效状态) | 返回 400 | P2 |
| ERR-03 | 空列表处理 | 获取空项目的任务列表 | 返回空数组而非错误 | P2 |
| ERR-04 | CORS 验证 | 前端跨域请求后端 API | CORS 头正确返回 | P1 |

---

## 优先级说明

| 级别 | 说明 | 通过标准 |
|------|------|----------|
| **P0** | 核心功能，必须通过 | 100% 通过 |
| **P1** | 重要功能，应该通过 | 建议 100% 通过 |
| **P2** | 次要功能，建议通过 | 可接受部分失败 |

## 冒烟测试通过标准

- 所有 **P0** 级测试用例必须通过
- **P1** 级测试用例建议全部通过
- 阻塞发布的问题必须在发布前修复

## 测试执行命令

```bash
# 启动后端服务
mvn spring-boot:run

# 启动前端服务
cd frontend && npm run dev

# 运行后端单元测试
mvn test

# 运行前端测试
cd frontend && npm run test
```
