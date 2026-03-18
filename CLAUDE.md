# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Build and Run Commands

### One-Click Start (Recommended)
Start both frontend and backend simultaneously:
```bash
./start.sh
```
- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Press `Ctrl+C` to stop all services

**Auto-restart**: If ports are occupied, the script will automatically kill the occupying processes and restart the services.

### Manual Start

### Backend (Node.js Fastify)
```bash
cd backend

# Install dependencies
npm install

# Run development server (port 8000)
npm run dev

# Or run directly
node src/main.js

# Run tests
npm test
```

### Frontend (Vue 3)
```bash
cd frontend

# Install dependencies
npm install

# Run development server (port 3000)
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

### Backend Structure (`backend/`)

| Directory | Purpose |
|-----------|---------|
| `src/` | Main application code |
| `src/config/` | Application configuration |
| `src/routes/` | API route handlers |
| `src/services/` | Business logic layer |
| `src/repositories/` | Data access layer (JSON file storage) |
| `src/middleware/` | Middleware (CORS, error handling) |
| `src/adapters/` | External service adapters (GitHub) |
| `src/utils/` | Utility functions (Git worktree) |
| `data/` | JSON data files |

**Backend Stack**: Fastify 4.x + Node.js + Zod + File-based JSON storage

### Frontend Structure (`frontend/src/`)

| Directory | Purpose |
|-----------|---------|
| `views/` | Page components (KanbanView, AgentConfig, TaskSourceConfig, ProjectListView) |
| `components/` | Reusable components (TaskCard, TaskDetail, DiffViewer, SessionTerminal) |
| `api/` | Axios-based API client modules |
| `router/` | Vue Router configuration |
| `stores/` | Pinia state management stores |

**Frontend Stack**: Vue 3 + Vite + Element Plus (UI) + Pinia (state) + vue-i18n + Native WebSocket

### File-Based Storage

Data is stored as JSON files in the `data/` directory (project root):
- `projects.json` - Project data
- `requirements.json` - Requirement data
- `tasks.json` - Task data
- `roles.json` - Role data
- `members.json` - Team member data

### API Endpoints

| Resource | Endpoints |
|----------|-----------|
| Projects | `GET/POST/PUT/DELETE /api/projects` |
| Requirements | `GET/POST/PUT/DELETE /api/requirements` |
| Tasks | `GET/POST/PUT/DELETE /api/tasks`, `PATCH /api/tasks/{id}/status` |
| Sessions | `GET/POST/DELETE /api/sessions` |
| Task Sources | `GET/POST/PUT/DELETE /api/task-sources` |
| Executions | `GET/POST/PUT/DELETE /api/executions` |
| Agents | `GET/POST/PUT/DELETE /api/agents` |
| Roles | `GET/POST/PUT/DELETE /api/roles` |
| Members | `GET/POST/PUT/DELETE /api/members` |

## Configuration

Application configuration in `backend/.env`:
- Server port: 8000
- Storage path: `../data`
- CORS origins: `http://localhost:3000,http://localhost:5173`

Frontend dev server proxies `/api` requests to backend at `http://localhost:8000` (see `frontend/vite.config.js`).

## Key Dependencies

**Backend**: Fastify 4.x, Node.js 18+, Zod, ws (WebSocket)

**Frontend**: Vue 3.4, Vite 5, Element Plus, Pinia, Axios, vue-router, vue-i18n, Native WebSocket

## Common Issues and Solutions

### 1. API Response Handling
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
The backend returns: `{ success: true/false, message: "...", data: {...}, error: null }`

### 2. JSON Data File Format
**Problem**: JSON files with Chinese characters may have encoding issues.
**Solution**: Use UTF-8 encoding. Validate JSON with:
```bash
node -e "JSON.parse(require('fs').readFileSync('data/projects.json'))"
```

### 3. Port Conflicts - Auto-Handled by start.sh
The `./start.sh` script automatically handles port conflicts:
- Checks if ports 3000 (frontend) and 8000 (backend) are occupied
- Automatically kills processes occupying those ports
- Restarts the services cleanly

Just run `./start.sh` again to restart everything.

### 4. Backend Data Path
**Problem**: Backend reads data from relative path `../data`. If started from wrong directory, it won't find data files.
**Solution**: Always start backend from project root directory or use `./start.sh`.

## Verification Commands

Use these commands to verify the application is working correctly:

### Quick Start Verification
```bash
# Start both services
./start.sh

# Wait for startup to complete, then verify:
curl http://localhost:8000/api/projects  # Should return JSON response
curl http://localhost:8000/api/members   # Should return member list
```

### Frontend Build Verification
```bash
cd frontend
npm run build  # Should complete without errors
```

### Backend Test Verification
```bash
cd backend
npm test  # Run Node.js built-in test runner
```
