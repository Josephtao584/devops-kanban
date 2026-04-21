# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Run Commands

### One-Click Start (Recommended)
```bash
./start.sh
```
- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- Auto-handles port conflicts and dependency installation

### Manual Start

**Backend (Node.js Fastify):**
```bash
cd backend
npm install
npm run dev          # Dev server with tsx watch (port 8000)
npm run build        # Build TypeScript output to dist/
node dist/src/main.js # Direct run of built backend
npm test             # TypeScript tests via Node test runner + tsx
```

**Frontend (Vue 3):**
```bash
cd frontend
npm install
npm run dev          # Dev server (port 3000)
npm run build        # Production build
npm run test         # Vitest in watch mode
npm run test:run     # Vitest single run (CI mode)
```

## Architecture Overview

DevOps Kanban board for managing projects/tasks with AI agent execution in isolated Git worktrees. Users create projects, define requirements and tasks, then execute tasks via AI coding agents (Claude Code) that work in separate Git branches.

### Backend (`backend/`) - Fastify 4.x + Zod + JSON file storage

**Layered architecture**: Routes → Services → Repositories → JSON files

- `src/main.js` - Entry point, registers all routes and plugins (CORS, WebSocket)
- `src/routes/` - Fastify route handlers (one file per resource)
- `src/services/` - Business logic (ProjectService, TaskService, SessionService, ExecutionService, TaskSourceService)
- `src/repositories/` - Data access with `BaseRepository` base class that provides CRUD over JSON files. Each entity repo extends it.
- `src/adapters/` - External integrations (GitHub task source adapter)
- `src/utils/response.js` - Standard response format: `{ success, message, data, error }`
- `src/utils/git.js` - Git worktree management (create/remove/list worktrees per task)
- `src/config/index.js` - Config from `.env`

**WebSocket** (`/ws`): Session-based real-time communication. Clients subscribe to session channels for streaming process output from AI agent executions. Uses `@fastify/websocket` plugin.

### Workflow System (Mastra-based)

**Architecture**: WorkflowService → Mastra Workflow Engine → WorkflowLifecycle → Executors

- `src/services/workflow/workflows.ts` - Dynamic workflow factory using Mastra. Builds workflows from templates at runtime.
- `src/services/workflow/workflowService.ts` - Orchestrates workflow execution, manages workflow runs, handles cancellation.
- `src/services/workflow/workflowLifecycle.ts` - Manages workflow step lifecycle (onStepStart, onStepComplete, onStepError, onStepCancel). Coordinates sessions and segments.
- `src/services/workflow/workflowTemplateService.ts` - Manages workflow templates (CRUD operations, built-in templates).
- `src/services/workflow/executors/` - Executor implementations (ClaudeCodeExecutor, CodexExecutor, OpenCodeExecutor).
- `src/repositories/workflowRunRepository.ts` - **Critical**: Uses `_serializeMutation` queue for all mutations (create/update/updateStep) to prevent race conditions.

**Key Concepts:**
- Workflows are built dynamically from templates using Mastra's `createWorkflow` and `createStep`
- Each step execution triggers lifecycle hooks (start → complete/error/cancel)
- WorkflowRunRepository serializes all mutations to prevent race conditions when steps execute rapidly
- Mastra stores workflow state in `data/mastra.db` (LibSQL)

**Agent Configuration:**
- Each Agent can configure `settingsPath` (optional) — maps to Claude Code CLI `--settings <path>` flag
- When `settingsPath` is set on an agent, the executor appends `--settings <path>` to the `claude` CLI invocation
- If not configured, no `--settings` flag is passed (default Claude Code behavior)
- This field only applies to `CLAUDE_CODE` executor type

### Frontend (`frontend/src/`) - Vue 3 + Vite 5 + Element Plus + Pinia

**Routes:**
- `/` → ProjectListView
- `/kanban/:projectId` → KanbanView (main board)
- `/task-sources/:projectId` → TaskSourceConfig
- `/agents` → AgentConfig

Key directories: `views/`, `components/`, `api/` (Axios clients), `stores/` (Pinia), `services/websocket.js` (native WebSocket client), `locales/` (i18n: zh-CN/en)

### Data Storage

JSON files in `data/` (project root, accessed via `../data` from backend):
- `projects.json`, `requirements.json`, `tasks.json`
- `agents.json`, `sessions.json`, `executions.json`, `task_sources.json`

### Task Status Workflow
```
TODO → IN_PROGRESS → DONE
      (also: REQUIREMENTS, BLOCKED, CANCELLED)
```
Priority levels: CRITICAL, HIGH, MEDIUM, LOW

### API Endpoints (all under `/api/`)

| Resource | Key Endpoints |
|----------|---------------|
| Projects | `GET/POST/PUT/DELETE /api/projects` |
| Requirements | `GET/POST/PUT/DELETE /api/requirements` |
| Tasks | `GET/POST/PUT/DELETE /api/tasks`, `PATCH /api/tasks/{id}/status` |
| Sessions | `GET/POST/DELETE /api/sessions` |
| Task Sources | `GET/POST/PUT/DELETE /api/task-sources` |
| Executions | `GET/POST/PUT/DELETE /api/executions` |
| Agents | `GET/POST/PUT/DELETE /api/agents` |
| Health | `GET /health`, `GET /` |

## Configuration

`backend/.env`: SERVER_PORT=8000, STORAGE_PATH=../data, CORS_ORIGINS=http://localhost:3000,http://localhost:5173

`frontend/vite.config.js`: Proxies `/api` to `http://localhost:8000`, defines `global: 'globalThis'` (sockjs-client polyfill)

## TypeScript Coding Standards

**Avoid TypeScript utility types** - Do not use `Pick<>`, `Omit<>`, `Partial<>`, or similar utility types. Instead:
- Use explicit inline type definitions: `{ field1: type1; field2?: type2 }`
- Declare full interfaces when types are reused
- Keep type definitions clear and self-contained

**Avoid unnecessary type assertions** - Do not use `as` type assertions unless absolutely necessary:
- Trust TypeScript's type inference
- Remove redundant `as Type | null` assertions on repository calls
- Use `const error: any = new Error()` when adding custom properties like `statusCode`
- Only use `as` when TypeScript cannot infer the correct type

**Examples:**
```typescript
// ❌ Avoid
agentRepo: Pick<AgentRepository, 'findById'>;
stepUpdate: Partial<Pick<WorkflowStepEntity, 'summary' | 'error'>>;
const task = await this.taskRepo.findById(taskId) as WorkflowTaskRecord | null;
const error = new Error('Not found') as Error & { statusCode?: number };

// ✅ Prefer
agentRepo: AgentRepository;
stepUpdate: { summary?: string | null; error?: string | null };
const task = await this.taskRepo.findById(taskId);
const error: any = new Error('Not found');
error.statusCode = 404;
```

## Common Issues

1. **API Response Handling**: Backend always returns `{ success, message, data, error }`. Frontend must check `response.success` before using `response.data`.

2. **Backend Data Path**: Uses relative `../data`. Always start from `backend/` directory or use `./start.sh`.

3. **Port Conflicts**: `./start.sh` auto-kills processes on ports 3000/8000 and restarts.

4. **JSON Encoding**: Data files use UTF-8. Validate with: `node -e "JSON.parse(require('fs').readFileSync('data/projects.json'))"`
