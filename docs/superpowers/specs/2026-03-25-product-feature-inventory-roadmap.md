# Product Feature Inventory & Roadmap

## Context

This document captures the current product capability landscape of the project and recommends the next most valuable feature directions. Its purpose is to serve as a stable local reference for future implementation planning, so later work can be split into focused implementation plans under `docs/superpowers/plans/`.

---

## Product Positioning

**One-line positioning:** This is an AI-native DevOps Kanban for engineering teams, connecting task management, multi-step workflow orchestration, AI agent execution, Git delivery, and external task-source ingestion into one delivery loop.

**Why this positioning fits:**
1. **Tasks are execution entry points** — task cards, task detail, chat/session, and execution history are already connected
2. **The product favors orchestrated delivery over one-off runs** — workflow templates, start-before-editing, snapshots, and step sessions all point to standardized delivery
3. **It goes deep into real engineering workflow** — worktree, diff, commit, merge, and MR capabilities are embedded into the task flow

---

## Current Feature Inventory

### 1. Project Workspace & Navigation
- Project list CRUD
- Main Kanban workspace with Kanban/List dual view
- Navigation entry points:
  - Project List
  - Kanban
  - Task Sources
  - My Team / Agents
  - Workflow Template
- Current route structure:
  - `/`
  - `/kanban/:projectId?`
  - `/task-sources/:projectId?`
  - `/agents`
  - `/workflow-template`

### 2. Task & Kanban Management
- Task creation, editing, deletion
- Drag-and-drop task movement between status columns
- Status-based board organization
- Priority and external-source identification
- Auto transition support
- Auto workflow assignment support
- Task category support:
  - Feature
  - Bug Fix
  - Refactoring
  - Documentation
  - Testing
  - Design

### 3. AI Session & Execution Collaboration
- Select agent from task detail and start a conversation
- Active session loading and session history display
- Legacy output compatibility in chat rendering
- Step-level session panel for workflow execution
- Execution history and execution detail drawer

### 4. Workflow Orchestration & Template System
- Task start flow:
  - Select workflow template
  - Edit workflow before start
  - Adjust step agent and step prompt
  - Confirm start
  - Submit template id + workflow snapshot
- Workflow template management:
  - Template CRUD
  - Multi-step editing
  - Step visualization
  - Step count constraints
- Workflow runtime visibility:
  - Progress dialog
  - Timeline dialog
  - Step session panel

### 5. Git / Worktree / Delivery Loop
- Unified diff rendering with DiffViewer
- Worktree panel with:
  - list
  - refresh
  - prune
  - status
  - diff
  - commit
  - push
  - merge
- Git actions embedded in task detail
- MR-oriented UI copy already exists
- Ongoing refinement:
  - Diff viewer style unification
  - Read-only diff mode vs commit-selection mode separation

### 6. External Task Source Integration
- Project-level task source management
- Supported source types exposed in UI:
  - GitHub
  - GitLab
  - Jira
  - Linear
  - Custom
- Connection testing
- Sync preview
- Selective import
- Dynamic config field rendering by source type

### 7. Agent / Team Configuration
- Multiple executor types:
  - CLAUDE_CODE
  - CODEX
  - OPENCODE
- Command override
- Arguments and environment variables
- Skill configuration
- Execution history visibility
- Current transition area:
  - old `type` vs new `executorType`
  - mixed terminology between executor/member/agent

### 8. Existing Platform Foundations
- Ongoing Mastra workflow-engine reintegration
- Existing WebSocket foundation, while some step-session flows still use polling
- Broad zh-CN i18n coverage with a few terminology cleanups still pending

---

## Recommended Next Directions

### P1. Task Source → Two-Way Operational Loop
**Type:** Short-term quick win

**What to build next:**
- Incremental sync instead of purely one-time import
- External status ↔ internal status mapping rules
- Write-back of execution result, MR link, or commit SHA to the external source
- Duplicate and conflict recognition

**Why this should come first:**
- The user value is immediate
- The current chain is already half built: source config → test connection → sync preview → import → board usage
- This closes the gap between demo workflow and daily team usage

**Existing foundations:**
- Task source config UI
- Task source APIs and adapter structure
- External-task markers already visible in the product

### P2. Workflow Template Productization
**Type:** Mid-term core differentiator

**What to build next:**
- Template versioning
- Template recommendation by task category
- Step entry/exit rules
- Retry and manual approval checkpoints
- Stronger template governance for team reuse

**Why this is strategically important:**
- This is the most differentiated part of the product today
- The end-to-end chain already exists, so the next step is productization rather than invention
- This is the best place to turn internal process knowledge into reusable delivery standards

**Existing foundations:**
- WorkflowTemplateConfig
- WorkflowStartEditorDialog
- WorkflowProgressDialog
- StepSessionPanel
- Workflow snapshot model

### P3. Agent Ops / Runtime Governance Layer
**Type:** Long-term platform direction

**What to build next:**
- Agent routing by task type / skill / role
- Runtime quality metrics and success rate visibility
- Cost / duration observability
- Environment templates and organization-level defaults
- Stronger governance on agent selection and execution policy

**Why it matters later:**
- The technical base already exists
- As task-source and workflow usage grow, governance becomes a natural next requirement
- This is the clearest path from “tool” to “team platform”

**Existing foundations:**
- AgentConfig
- executorType abstraction
- command/env/args/skills model
- execution history

---

## Important Ongoing Technical Themes

These are already visible in the repository and are worth finishing in parallel with feature work:

1. **Mastra workflow-engine reintegration**
2. **WebSocket replacing polling for execution visibility**
3. **DiffViewer dual-mode refinement**
4. **Agent terminology unification in UI copy**
5. **Worktree card quick actions expansion**

---

## Priority Summary

| Priority | Direction | Category | Why now |
|----------|-----------|----------|---------|
| P1 | Task source two-way loop | Quick win | Closest to user value and strongest short-term ROI |
| P2 | Workflow template productization | Core differentiator | Most complete and most defensible capability |
| P3 | Agent Ops / governance layer | Platform evolution | Natural next layer after workflow and source usage mature |
| Parallel | Mastra / WebSocket / Diff dual-mode | Technical evolution | Raises the product quality baseline across multiple features |

---

## Suggested Follow-up Planning Pattern

Use this document as the source inventory. When a direction is chosen, split it into a dedicated implementation plan under `docs/superpowers/plans/`.

Recommended next plan candidates:
1. `task-source-two-way-sync`
2. `workflow-template-versioning-and-recommendation`
3. `agent-runtime-governance`
