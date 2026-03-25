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
