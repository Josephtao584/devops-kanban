# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Build and Run Commands

### One-Click Start (Recommended)
Start both frontend and backend simultaneously:
```bash
./start.sh
```
- Frontend: http://localhost:5173
- Backend: http://localhost:8080
- Press `Ctrl+C` to stop all services

### Manual Start

### Backend (Spring Boot)
```bash
# Run development server (port 8080)
mvn spring-boot:run

# Build JAR
mvn package

# Run all tests
mvn test

# Run a single test class
mvn test -Dtest=ProjectServiceTest

# Run a single test method
mvn test -Dtest=ProjectServiceTest#testCreateProject
```

#### Alternative: Run with Java directly (when Maven is not in PATH)
If `mvn` is not available in the shell environment, you can run the compiled classes directly:

```bash
# Set JAVA_HOME to your Java installation
JAVA_HOME=/path/to/your/java/installation

# Run the application (requires compiled classes in target/classes)
$JAVA_HOME/bin/java -Dfile.encoding=UTF-8 \
  -cp "target/classes:$(cat .classpath)" \
  com.devops.kanban.DevopsKanbanApplication
```

Or use the full classpath command (run `mvn dependency:build-classpath -Dmdep.outputFile=.classpath` to generate):
```bash
$JAVA_HOME/bin/java \
  -Dfile.encoding=UTF-8 \
  -cp "target/classes:$(cat .classpath)" \
  com.devops.kanban.DevopsKanbanApplication
```

### Frontend (Vue 3)
```bash
cd frontend

# Install dependencies
npm install

# Run development server (port 5173)
npm run dev

# Build for production
npm run build

# Run tests
npm run test

# Run tests once (CI mode)
npm run test:run
```

## Architecture Overview

This is a DevOps Kanban board application for managing tasks with AI agent execution capabilities. The system allows users to manage projects, tasks, and execute tasks using AI coding agents in isolated Git worktrees.

### Backend Structure (`src/main/java/com/devops/kanban/`)

| Package | Purpose |
|---------|---------|
| `entity/` | Domain entities: Project, Task, TaskSource, Agent, Execution, Session |
| `dto/` | Data Transfer Objects for API requests/responses |
| `repository/` | Repository interfaces with `impl/` containing file-based JSON implementations |
| `service/` | Business logic including GitService for worktree management |
| `controller/` | REST API endpoints |
| `spi/` | Service Provider Interfaces for extensibility |
| `adapter/` | SPI implementations for task sources and AI agents |

### Frontend Structure (`frontend/src/`)

| Directory | Purpose |
|-----------|---------|
| `views/` | Page components (KanbanView, AgentConfig, TaskSourceConfig, ProjectListView) |
| `components/` | Reusable components (TaskCard, TaskDetail, DiffViewer, SessionTerminal) |
| `api/` | Axios-based API client modules |
| `router/` | Vue Router configuration |
| `stores/` | Pinia state management stores |

**Frontend Stack**: Vue 3 + Vite + Element Plus (UI) + Pinia (state) + vue-i18n + WebSocket (STOMP over SockJS)

### Key Architectural Patterns

**SPI (Service Provider Interface)**: The system uses SPI interfaces for extensibility:
- `TaskSourceAdapter`: Implement to add new external task sources (GitHub, Jira, etc.)
- `AgentAdapter`: Implement to add new AI agent integrations (Claude, Codex, etc.)

New adapters are auto-discovered via Spring's `@Component` annotation and registered by type. See `spi/` package for interface definitions.

**File-Based Storage**: Data is stored as JSON files in `./data/` directory (configurable via `app.storage.path`). Each entity type has a dedicated file per project (e.g., `tasks_1.json`).

**Git Worktree Isolation**: Each task execution creates an isolated Git worktree to allow parallel agent execution without conflicts. See `GitService.createWorktree()`.

**WebSocket Terminal Sessions**: Real-time bidirectional communication with AI agents via WebSocket (STOMP protocol). Sessions track agent processes and allow terminal-like interaction. See `SessionController` and `SessionService`.

### Entity Relationships

```
Project (1) ─┬─ (N) Task
              ├─ (N) TaskSource (external task providers)
              └─ (N) Agent (AI execution agents)

Task (1) ────── (N) Execution (agent execution records)
Task (1) ────── (N) Session (interactive terminal sessions)
```

### Task Status Flow

`TODO` → `IN_PROGRESS` → `DONE` (also: `BLOCKED`, `CANCELLED`)

### Session Status Flow

`CREATED` → `RUNNING` ↔ `IDLE` → `STOPPED` (also: `ERROR`)

## API Reference

See [API.md](API.md) for complete API documentation including all endpoints, request/response schemas, and DTOs.

## Configuration

Application configuration in `src/main/resources/application.yml`:
- Server port: 8080
- Storage path: `./data`
- CORS origins: `http://localhost:5173,http://localhost:3000`

Frontend dev server proxies `/api` requests to backend at `http://localhost:8080` (see `frontend/vite.config.js`).

## Key Dependencies

**Backend**: Spring Boot 3.2.5, Java 17, JGit (Git operations), Lombok, Jackson (JSON), WebSocket/STOMP

**Frontend**: Vue 3.4, Vite 5, Element Plus, Pinia, Axios, vue-router, vue-i18n, @stomp/stompjs, sockjs-client, vitest (testing)

## Common Issues and Solutions

### 1. Frontend API Method Name Mismatch
**Problem**: Frontend calls `agentApi.getByProject()` but API module only exports `getAll()`.
**Solution**: Ensure all API modules export methods with consistent naming. Check `frontend/src/api/*.js` files.
```javascript
// In agent.js, both methods should exist:
const agentApi = {
  getAll: (projectId) => api.get('/agents', { params: { projectId } }),
  getByProject: (projectId) => api.get('/agents', { params: { projectId } }),
  // ...other methods
}
```

### 2. API Response Handling
**Problem**: Frontend doesn't check `response.success` before using `response.data`.
**Solution**: Always check API response format:
```javascript
const response = await someApi.call()
if (response.success && response.data) {
  // Use response.data
} else {
  // Handle error: response.message
}
```
The backend returns: `{ success: true/false, message: "...", data: {...} }`

### 3. JSON Data File Format
**Problem**: JSON files with Chinese characters may have encoding issues.
**Solution**: Use ASCII-only content for test data files, or ensure UTF-8 encoding. Validate JSON with:
```bash
python3 -m json.tool data/projects.json
```

### 4. Task Data Storage Structure
**Problem**: Tasks are stored per-project as `tasks_{projectId}.json`, not a single `tasks.json`.
**Solution**: Create task data files with correct naming:
```
data/
├── projects.json
├── tasks_1.json    # Tasks for project ID 1
├── tasks_2.json    # Tasks for project ID 2
├── agents.json
└── task_sources.json
```

### 5. Vite 5 + sockjs-client Global Polyfill
**Problem**: `sockjs-client` requires `global` variable which Vite 5 doesn't provide by default.
**Error**: `Uncaught ReferenceError: global is not defined`
**Solution**: Add to `frontend/vite.config.js`:
```javascript
export default defineConfig({
  // ...other config
  define: {
    global: 'globalThis'
  }
})
```

### 6. Multiple Running Processes
**Problem**: Multiple `npm run dev` or `java` processes cause port conflicts.
**Solution**: Before starting, kill existing processes:
```bash
# Kill old node/vite processes
pkill -f "vite" || true
pkill -f "npm run dev" || true

# Kill old Spring Boot processes on port 8080
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
```

### 7. Backend Startup with Missing Dependencies
**Problem**: Running Java directly with `-cp` may miss transitive dependencies like `snakeyaml`.
**Solution**: Prefer using `mvn spring-boot:run` or the full classpath command in CLAUDE.md. The full classpath must include ALL transitive dependencies.

### 8. Backend Working Directory Must Be Project Root
**Problem**: Backend reads data from relative path `./data`. If started from wrong directory (e.g., `frontend/`), it won't find data files.
**Solution**: Always start backend from project root directory:
```bash
cd /path/to/devops-kanban
# Then run the java command
```
**Verify**: Check with `lsof -p <PID> | grep cwd` to ensure working directory is correct.

### 9. all_tasks.json Required for Task Lookup by ID
**Problem**: `findById()` uses `all_tasks.json` to look up tasks. If this file is missing, task operations fail with "Task not found".
**Solution**: When creating test data, ensure `all_tasks.json` exists:
```bash
# Generate all_tasks.json from project task files
cat data/tasks_*.json | jq -s 'add' > data/all_tasks.json
```
**Note**: The backend auto-generates this file when saving tasks, but manual data creation requires this step.

## Verification Commands

Use these commands to verify the application is working correctly:

### Quick Start Verification
```bash
# Start both services
./start.sh

# Wait for startup to complete, then verify:
curl http://localhost:8080/api/projects  # Should return JSON response
```

### Frontend Build Verification
```bash
cd frontend
npm run build  # Should complete without errors
```

### Backend Test Verification
```bash
mvn test  # Run all backend tests
```
