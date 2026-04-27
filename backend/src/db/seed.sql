-- ============================================================
-- Minimal Seed Data for Coplat
-- Only essential defaults; templates and agents available via preset packages
-- ============================================================

-- === projects ===
INSERT INTO projects (id, name, description, git_url, local_path, created_at, updated_at) VALUES
  (1, 'DevOps 看板系统', '基于 AI 代理的 DevOps 看板管理系统，支持任务自动化执行', 'https://github.com/example/coplat.git', '__PROJECT_ROOT__', '2026-03-17T07:03:51.577Z', '2026-03-18T03:32:51.735Z');

-- === iterations ===
INSERT INTO iterations (id, project_id, name, goal, status, start_date, end_date, created_at, updated_at) VALUES
  (1, 1, '26.3.0', '完成基础功能开发', 'ACTIVE', '2026-03-01', '2026-03-31', '2026-03-17T07:03:51.577Z', '2026-03-17T07:03:51.577Z');
INSERT INTO iterations (id, project_id, name, goal, status, start_date, end_date, created_at, updated_at) VALUES
  (2, 1, '26.4.0', '完成高级功能开发', 'PLANNED', '2026-04-01', '2026-04-30', '2026-03-17T07:03:51.577Z', '2026-03-17T07:03:51.577Z');

-- === agents (minimal: only architect) ===
INSERT INTO agents (id, name, executorType, role, description, enabled, skills, mcp_servers, env, created_at, updated_at) VALUES
  (1, '架构师', 'OPEN_CODE', 'ARCHITECT', '负责系统架构设计与技术方案评审', 1, '[]', '[]', '{}', '2026-03-17T00:00:00.000Z', '2026-03-31T00:00:00.000Z');

-- === workflow_templates (minimal: only repo-explorer) ===
INSERT INTO workflow_templates (id, template_id, name, steps, "order", created_at, updated_at) VALUES
  (1, 'repo-explorer', '探索代码仓', '[{"id":"explore","name":"代码仓探索","instructionPrompt":"你是一个代码分析专家。请深入分析当前代码仓库，生成一份结构化的介绍报告。\n\n分析内容：\n1. **项目概览**：目录结构、技术栈识别、主要语言统计、README 摘要\n2. **核心模块**：识别核心模块及其职责、入口文件分析\n3. **依赖关系**：主要依赖及其用途、模块间依赖关系\n4. **架构模式**：识别架构模式（MVC、分层架构等）\n\n最终输出格式化的 Markdown 报告，保存到 KANBAN_COMPASS.md 文件中。该文件将作为后续工作流执行的参考文档，其他工作流的 Agent 会读取此文件来了解项目结构。","agentId":1,"requiresConfirmation":false}]', 0, '2026-04-09T00:00:00.000Z', '2026-04-09T00:00:00.000Z');

-- === tasks ===
INSERT INTO tasks (id, title, description, project_id, status, priority, source, labels, "order", iteration_id, workflow_run_id, worktree_path, worktree_branch, created_at, updated_at) VALUES
  (1, '设计看板 UI 布局', '设计看板页面的 UI 布局和交互效果', 1, 'TODO', 'HIGH', 'manual', '["frontend"]', 0, NULL, NULL, NULL, NULL, '2026-03-17T07:03:51.577Z', '2026-03-17T07:03:51.577Z');
INSERT INTO tasks (id, title, description, project_id, status, priority, source, labels, "order", iteration_id, workflow_run_id, worktree_path, worktree_branch, created_at, updated_at) VALUES
  (2, '实现项目 API 接口', '创建 RESTful API 接口，支持 CRUD 操作', 1, 'TODO', 'HIGH', 'manual', '["backend"]', 1, NULL, NULL, NULL, NULL, '2026-03-17T07:03:51.577Z', '2026-03-17T07:03:51.577Z');
INSERT INTO tasks (id, title, description, project_id, status, priority, source, labels, "order", iteration_id, workflow_run_id, worktree_path, worktree_branch, created_at, updated_at) VALUES
  (3, '集成 AI 代理功能', '集成 AI 代理实现自动化任务执行', 1, 'TODO', 'HIGH', 'manual', '["ai"]', 2, NULL, NULL, NULL, NULL, '2026-03-17T07:03:51.577Z', '2026-03-17T07:03:51.577Z');

-- === task_sources ===
INSERT INTO task_sources (id, name, type, project_id, config, enabled, last_sync_at, created_at, updated_at) VALUES
  (1, 'git', 'GITHUB', 1, '{"repo":"https://github.com/example/your-repo.git","token":"","state":"open"}', 1, '2026-03-18T06:30:45.183Z', '2026-03-18T11:36:52.653Z', '2026-03-18T06:30:45.183Z');

-- === settings ===
INSERT INTO settings (key, value, updated_at) VALUES ('scheduler.workflow_dispatch_cron', '*/5 * * * *', datetime('now'));
INSERT INTO settings (key, value, updated_at) VALUES ('scheduler.max_concurrent_workflows', '3', datetime('now'));
INSERT INTO settings (key, value, updated_at) VALUES ('scheduler.max_tasks_per_execution', '10', datetime('now'));
