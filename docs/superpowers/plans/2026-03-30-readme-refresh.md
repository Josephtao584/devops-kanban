# README Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `README.md` so it stays Chinese-first, reflects the current codebase accurately, and helps new readers understand, start, and use the project quickly.

**Architecture:** Replace the current README with a tighter top-down document: concise positioning first, then core capabilities, quick start, usage flow, architecture, and developer guidance. Keep Harness Engineering as the narrative spine, but remove repeated explanation and overly detailed task source configuration material.

**Tech Stack:** Markdown, GitHub Flavored Markdown, existing repository docs in `CLAUDE.md`.

---

### Task 1: Rebuild README structure

**Files:**
- Modify: `README.md`
- Reference: `CLAUDE.md`
- Reference: `docs/superpowers/specs/2026-03-30-readme-refresh-design.md`

- [ ] **Step 1: Read the current design inputs**

Read these files before editing:
- `README.md`
- `CLAUDE.md`
- `docs/superpowers/specs/2026-03-30-readme-refresh-design.md`

Expected: confirm the target sections are project intro, core capabilities, quick start, usage flow, architecture, developer notes, contribution/license.

- [ ] **Step 2: Replace the README with the new top-level structure**

Write `README.md` with these section headings in this order:

```md
# DevOps Kanban

## 项目简介
## 核心能力
## 快速开始
## 典型使用流程
## 架构概览
## 开发说明
## 贡献与许可
```

Expected: the old long-form repetitive sections are removed, and the new structure matches the approved design.

- [ ] **Step 3: Rewrite the opening positioning copy**

Use concise opening copy covering what the project is, what it solves, and who it is for. Include content equivalent to:

```md
DevOps Kanban 是一个面向 Harness Engineering 的开源任务编排平台，用于把项目、需求、任务、AI Agent 执行、Git Worktree 隔离和人工审查连接成完整交付流程。

它适合希望把 Claude Code 等 coding agent 接入真实研发流程的团队，也适合在本地验证 agent workflow、session resume、隔离执行和 human-in-the-loop 交付模式的开发者。
```

Expected: readers can understand the project in under 30 seconds.

### Task 2: Refresh operational content

**Files:**
- Modify: `README.md`
- Reference: `CLAUDE.md`

- [ ] **Step 1: Rewrite the core capabilities section**

Add a concise list or table covering these capabilities:

```md
- 项目 / 需求 / 任务看板管理
- AI Agent 配置与执行
- Git Worktree 隔离执行
- Session / Execution / WebSocket 实时观察与恢复
- Workflow 模板与执行体系
```

Expected: capabilities reflect the current repo focus, including workflows.

- [ ] **Step 2: Rewrite quick start with current commands**

Use commands aligned with `CLAUDE.md`:

```bash
./start.sh
```

```bash
cd backend
npm install
npm run dev
```

```bash
cd frontend
npm install
npm run dev
```

Also include access URLs:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`

Expected: a contributor can start the system without reading other docs.

- [ ] **Step 3: Rewrite the typical usage flow**

Describe this sequence in short numbered steps:

```md
1. 创建项目并关联仓库
2. 配置 Agent
3. 创建需求和任务
4. 启动执行
5. 在执行过程中通过 WebSocket 交互
6. 审查 worktree 代码并决定合并
```

Expected: the README emphasizes human-in-the-loop execution instead of black-box automation.

### Task 3: Refresh architecture and developer guidance

**Files:**
- Modify: `README.md`
- Reference: `CLAUDE.md`

- [ ] **Step 1: Rewrite the architecture overview**

Add a concise architecture section covering:

```md
- backend/：Fastify + Zod + JSON 文件存储，分层为 routes / services / repositories
- frontend/：Vue 3 + Vite + Element Plus + Pinia
- data/：项目、任务、会话、执行、Agent 等 JSON 数据
- workflow：基于 Mastra 的动态 workflow、lifecycle 和 executor 体系
```

Expected: the architecture snapshot matches the current repository.

- [ ] **Step 2: Rewrite developer notes**

Include these categories:

```md
- 常用开发命令
- API 响应格式：{ success, message, data, error }
- 数据目录与端口说明
- 可扩展点：任务源、执行器 / Agent
```

Expected: common setup pitfalls and extension points are easy to find.

- [ ] **Step 3: Remove over-detailed task source appendix content**

Delete or sharply reduce the long sections about:

```md
- UniversalAdapter config.yaml 结构
- JSONPath 语法说明
- transforms 语法说明
- Jira 示例的长篇配置
```

Expected: README stays focused on overview and onboarding rather than full adapter implementation details.

### Task 4: Verify final README

**Files:**
- Read: `README.md`

- [ ] **Step 1: Read the updated README**

Read back `README.md` after editing.

Expected: all target sections exist and the removed appendix-style material is gone.

- [ ] **Step 2: Verify design coverage**

Check that the final README includes all required sections:

```md
- 项目简介
- 核心能力
- 快速开始
- 典型使用流程
- 架构概览
- 开发说明
- 贡献与许可
```

Expected: full design coverage with no extra detours.

- [ ] **Step 3: Verify content quality**

Confirm:
- opening is concise
- startup commands match `CLAUDE.md`
- architecture mentions workflow/Mastra
- repeated philosophy sections were reduced
- task source implementation details were removed or minimized

Expected: README is shorter, more accurate, and easier to scan.
