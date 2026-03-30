# Skill Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Skill 管理系统，允许用户上传、管理 skills，并在 Workflow 启动时自动同步到项目的 `.claude/skills/` 目录，使 Claude Code Agent 能真正使用 Skill 工具。

**Architecture:** 采用前后分离架构，后端提供 REST API 和文件管理，前端提供管理界面。Skill 文件存储在 `data/skills/{skill-name}/`，通过 `skillSync.ts` 同步到项目目录。

**Tech Stack:** Node.js + Fastify (后端), Vue 3 + Pinia (前端), ZIP 解压 (node:fs + adm-zip)

---

## File Structure

### Backend (新增)
- `backend/src/types/entities.ts` - 添加 SkillEntity 类型
- `backend/src/repositories/skillRepository.ts` - Skill 数据访问层
- `backend/src/services/skillService.ts` - Skill 业务逻辑（依赖注入）
- `backend/src/routes/skills.ts` - REST API 路由
- `backend/src/utils/skillSync.ts` - Skill 同步工具
- `backend/src/services/workflow/workflowSkillSync.ts` - Workflow 集成
- `backend/test/skillService.test.ts` - 单元测试

### Backend (修改)
- `backend/src/app.ts` - 注册 skillRoutes
- `backend/src/routes/index.ts` - 导出 skillRoutes
- `backend/src/services/workflow/workflowService.ts` - 调用 syncWorkflowSkills

### Frontend (新增)
- `frontend/src/api/skill.js` - API 客户端
- `frontend/src/stores/skillStore.js` - Pinia store
- `frontend/src/views/SkillConfig.vue` - Skill 管理界面

### Frontend (修改)
- `frontend/src/router/index.js` - 添加 SkillConfig 路由

---

## Task 1: 添加 SkillEntity 类型

**Files:**
- Modify: `backend/src/types/entities.ts`

- [ ] **Step 1: 在 entities.ts 末尾添加 SkillEntity 类型**

在 `ExecutionEntity` 后添加：

```typescript
export interface SkillEntity {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: 验证类型添加成功**

运行: `cd backend && npx tsc --noEmit src/types/entities.ts`

---

## Task 2: 创建 SkillRepository

**Files:**
- Create: `backend/src/repositories/skillRepository.ts`

- [ ] **Step 1: 创建 SkillRepository**

```typescript
import { BaseRepository } from './base.js';
import type { SkillEntity } from '../types/entities.js';

class SkillRepository extends BaseRepository<SkillEntity> {
  constructor() {
    super('skills.json');
  }
}

export { SkillRepository };
```

- [ ] **Step 2: 验证编译**

运行: `cd backend && npx tsc --noEmit src/repositories/skillRepository.ts`

---

## Task 3: 创建 SkillService（依赖注入模式）

**Files:**
- Create: `backend/src/services/skillService.ts`
- Test: `backend/test/skillService.test.ts`

- [ ] **Step 1: 编写 SkillService 单元测试**

```typescript
import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { SkillService } from '../src/services/skillService.js';

async function withIsolatedStorage(run: (tempRoot: string) => Promise<void>) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-service-test-'));
  try {
    await run(tempRoot);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

test.test('createSkill creates skill record and initializes skill directory', async () => {
  await withIsolatedStorage(async (tempRoot) => {
    const service = new SkillService({ storagePath: tempRoot });
    const skill = await service.createSkill('brainstorming', '用于头脑风暴的技能');

    assert.equal(skill.name, 'brainstorming');
    assert.equal(skill.description, '用于头脑风暴的技能');
  });
});

test.test('createSkill prevents duplicate names', async () => {
  await withIsolatedStorage(async (tempRoot) => {
    const service = new SkillService({ storagePath: tempRoot });
    await service.createSkill('brainstorming');

    await assert.rejects(
      async () => service.createSkill('brainstorming'),
      /already exists/
    );
  });
});

test.test('listSkills returns all created skills', async () => {
  await withIsolatedStorage(async (tempRoot) => {
    const service = new SkillService({ storagePath: tempRoot });
    await service.createSkill('skill1');
    await service.createSkill('skill2');

    const skills = await service.listSkills();

    assert.equal(skills.length, 2);
  });
});

test.test('deleteSkill removes skill record', async () => {
  await withIsolatedStorage(async (tempRoot) => {
    const service = new SkillService({ storagePath: tempRoot });
    const created = await service.createSkill('to-delete');

    const deleted = await service.deleteSkill(created.id);

    assert.equal(deleted, true);
    const skills = await service.listSkills();
    assert.equal(skills.length, 0);
  });
});

test.test('deleteSkill returns false for non-existent id', async () => {
  await withIsolatedStorage(async (tempRoot) => {
    const service = new SkillService({ storagePath: tempRoot });
    const deleted = await service.deleteSkill(9999);
    assert.equal(deleted, false);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

运行: `cd backend && npm test -- test/skillService.test.ts`
预期: FAIL（SkillService 未实现）

- [ ] **Step 3: 实现 SkillService**

```typescript
import { SkillRepository } from '../repositories/skillRepository.js';
import type { SkillEntity } from '../types/entities.js';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

class SkillService {
  skillRepo: SkillRepository;
  storagePath: string;

  constructor(options: { storagePath?: string; skillRepo?: SkillRepository } = {}) {
    this.storagePath = options.storagePath || process.cwd();
    this.skillRepo = options.skillRepo || new SkillRepository({ storagePath: this.storagePath });
  }

  async listSkills(): Promise<SkillEntity[]> {
    return await this.skillRepo.findAll();
  }

  async getSkill(id: number): Promise<SkillEntity | null> {
    return await this.skillRepo.findById(id);
  }

  async createSkill(name: string, description?: string): Promise<SkillEntity> {
    // 检查是否已存在同名 skill
    const existing = await this.listSkills();
    if (existing.some(s => s.name === name)) {
      const error: any = new Error(`Skill "${name}" already exists`);
      error.statusCode = 409;
      throw error;
    }

    // 初始化 skill 目录
    const skillDir = this.getSkillDir(name);
    if (!existsSync(skillDir)) {
      mkdirSync(skillDir, { recursive: true });
    }

    return await this.skillRepo.create({ name, description });
  }

  async updateSkill(id: number, description?: string): Promise<SkillEntity | null> {
    return await this.skillRepo.update(id, { description });
  }

  async deleteSkill(id: number): Promise<boolean> {
    const skill = await this.skillRepo.findById(id);
    if (!skill) {
      return false;
    }

    const deleted = await this.skillRepo.delete(id);
    if (deleted) {
      // 删除 skill 目录
      const skillDir = this.getSkillDir(skill.name);
      if (existsSync(skillDir)) {
        rmSync(skillDir, { recursive: true });
      }
    }
    return deleted;
  }

  getSkillDir(name: string): string {
    return resolve(this.storagePath, 'skills', name);
  }
}

export { SkillService };
```

- [ ] **Step 4: 运行测试验证通过**

运行: `cd backend && npm test -- test/skillService.test.ts`
预期: PASS

- [ ] **Step 5: 提交**

```bash
git add backend/src/types/entities.ts backend/src/repositories/skillRepository.ts backend/src/services/skillService.ts backend/test/skillService.test.ts
git commit -m "feat: add Skill entity and repository with dependency injection"
```

---

## Task 4: 创建 skillSync 工具

**Files:**
- Create: `backend/src/utils/skillSync.ts`

- [ ] **Step 1: 创建 skillSync 工具**

```typescript
import { existsSync, cpSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export async function ensureSkillsInWorktree(skillNames: string[], projectPath: string): Promise<void> {
  if (!skillNames || skillNames.length === 0) {
    return;
  }

  const targetSkillsDir = resolve(projectPath, '.claude', 'skills');

  // 确保 .claude/skills 目录存在
  if (!existsSync(targetSkillsDir)) {
    mkdirSync(targetSkillsDir, { recursive: true });
    console.log(`[skillSync] Created directory: ${targetSkillsDir}`);
  }

  for (const skillName of skillNames) {
    const sourceDir = resolve(process.cwd(), 'data', 'skills', skillName);
    const targetDir = resolve(targetSkillsDir, skillName);

    // 已存在则跳过
    if (existsSync(targetDir)) {
      console.log(`[skillSync] Skill "${skillName}" already exists in project, skipping`);
      continue;
    }

    // 复制 skill 目录
    if (existsSync(sourceDir)) {
      cpSync(sourceDir, targetDir, { recursive: true });
      console.log(`[skillSync] Copied skill "${skillName}" to project: ${targetDir}`);
    } else {
      console.warn(`[skillSync] Skill "${skillName}" not found in data/skills, skipping`);
    }
  }
}
```

- [ ] **Step 2: 验证编译**

运行: `cd backend && npx tsc --noEmit src/utils/skillSync.ts`

- [ ] **Step 3: 提交**

```bash
git add backend/src/utils/skillSync.ts
git commit -m "feat: add skillSync utility for syncing skills to project"
```

---

## Task 5: 创建 Skill API 路由

**Files:**
- Create: `backend/src/routes/skills.ts`
- Modify: `backend/src/routes/index.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: 创建 SkillRoutes**

```typescript
import type { FastifyPluginAsync } from 'fastify';
import { SkillService } from '../services/skillService.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { parseNumber, getErrorMessage, getStatusCode } from '../utils/http.js';
import type { IdParams } from '../types/http/params.js';

type SkillRouteOptions = {
  skillService?: SkillService;
};

export const skillRoutes: FastifyPluginAsync<SkillRouteOptions> = async (fastify, { skillService = new SkillService() } = {}) => {
  fastify.get('/', async (request, reply) => {
    try {
      return successResponse(await skillService.listSkills());
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get skills'));
    }
  });

  fastify.get<{ Params: IdParams }>('/:id', async (request, reply) => {
    try {
      const skill = await skillService.getSkill(parseNumber(request.params.id));
      if (!skill) {
        reply.code(404);
        return errorResponse('Skill not found');
      }
      return successResponse(skill);
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get skill'));
    }
  });

  fastify.post<{ Body: { name: string; description?: string } }>('/', async (request, reply) => {
    try {
      const { name, description } = request.body;

      if (!name || typeof name !== 'string' || name.trim() === '') {
        reply.code(400);
        return errorResponse('name is required');
      }

      const skill = await skillService.createSkill(name.trim(), description);
      return successResponse(skill, 'Skill created');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to create skill'));
    }
  });

  fastify.put<{ Params: IdParams; Body: { description?: string } }>('/:id', async (request, reply) => {
    try {
      const { description } = request.body;
      const updated = await skillService.updateSkill(parseNumber(request.params.id), description);
      if (!updated) {
        reply.code(404);
        return errorResponse('Skill not found');
      }
      return successResponse(updated, 'Skill updated');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to update skill'));
    }
  });

  fastify.delete<{ Params: IdParams }>('/:id', async (request, reply) => {
    try {
      const deleted = await skillService.deleteSkill(parseNumber(request.params.id));
      if (!deleted) {
        reply.code(404);
        return errorResponse('Skill not found');
      }
      return successResponse(null, 'Skill deleted');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to delete skill'));
    }
  });
};
```

- [ ] **Step 2: 导出 skillRoutes**

在 `backend/src/routes/index.ts` 添加:
```typescript
export { skillRoutes } from './skills.js';
```

- [ ] **Step 3: 注册路由**

在 `backend/src/app.ts`:
1. 导入 `skillRoutes`
2. 添加 `fastify.register(skillRoutes, { prefix: '/api/skills' });`

- [ ] **Step 4: 验证编译**

运行: `cd backend && npx tsc --noEmit`

- [ ] **Step 5: 提交**

```bash
git add backend/src/routes/skills.ts backend/src/routes/index.ts backend/src/app.ts
git commit -m "feat: add skill API routes"
```

---

## Task 6: 创建 workflowSkillSync 集成

**Files:**
- Create: `backend/src/services/workflow/workflowSkillSync.ts`
- Modify: `backend/src/services/workflow/workflowService.ts`

- [ ] **Step 1: 创建 workflowSkillSync**

```typescript
import { ensureSkillsInWorktree } from '../../utils/skillSync.js';
import { AgentRepository } from '../../repositories/agentRepository.js';
import type { WorkflowTemplateEntity } from '../../types/entities.js';

const agentRepo = new AgentRepository();

export async function syncWorkflowSkills(
  workflowTemplate: WorkflowTemplateEntity,
  projectPath: string
): Promise<void> {
  // 获取所有 step 用到的 agent IDs（去重）
  const agentIds = [...new Set(
    workflowTemplate.steps
      .map(s => s.agentId)
      .filter((id): id is number => id !== undefined)
  )];

  if (agentIds.length === 0) {
    console.log('[workflowSkillSync] No agents found in workflow template');
    return;
  }

  // 收集所有 skills
  const allSkills = new Set<string>();
  for (const agentId of agentIds) {
    const agent = await agentRepo.findById(agentId);
    if (agent?.skills && Array.isArray(agent.skills)) {
      agent.skills.forEach(s => allSkills.add(s));
    }
  }

  if (allSkills.size === 0) {
    console.log('[workflowSkillSync] No skills found in workflow agents');
    return;
  }

  console.log(`[workflowSkillSync] Syncing ${allSkills.size} skills to project: ${projectPath}`);
  await ensureSkillsInWorktree([...allSkills], projectPath);
}
```

- [ ] **Step 2: 在 workflowService 中调用**

在 `backend/src/services/workflow/workflowService.ts` 的 `_executeWorkflow` 方法开头添加:

```typescript
import { syncWorkflowSkills } from './workflowSkillSync.js';

// 在 _executeWorkflow 方法开头添加：
await syncWorkflowSkills(workflowTemplate, task.execution_path);
```

- [ ] **Step 3: 验证编译**

运行: `cd backend && npx tsc --noEmit`

- [ ] **Step 4: 提交**

```bash
git add backend/src/services/workflow/workflowSkillSync.ts backend/src/services/workflow/workflowService.ts
git commit -m "feat: integrate skill sync with workflow execution"
```

---

## Task 7: 创建前端 Skill API 和 Store

**Files:**
- Create: `frontend/src/api/skill.js`
- Create: `frontend/src/stores/skillStore.js`

- [ ] **Step 1: 创建 API 客户端**

```javascript
import api from './index.js'

export const skillApi = {
  list: () => api.get('/skills'),
  get: (id) => api.get(`/skills/${id}`),
  create: (data) => api.post('/skills', data),
  update: (id, data) => api.put(`/skills/${id}`, data),
  delete: (id) => api.delete(`/skills/${id}`)
}
```

- [ ] **Step 2: 创建 Pinia Store**

```javascript
import { defineStore } from 'pinia'
import { useCrudStore } from '../composables/useCrudStore'
import * as skillApi from '../api/skill'

export const useSkillStore = defineStore('skill', () => {
  const crud = useCrudStore({
    api: skillApi,
    apiMethods: {
      getAll: 'list',
      getById: 'get',
      create: 'create',
      update: 'update',
      delete: 'delete'
    }
  })

  return {
    skills: crud.items,
    currentSkill: crud.currentItem,
    loading: crud.loading,
    error: crud.error,
    fetchSkills: crud.fetchAll,
    fetchSkill: crud.fetchById,
    createSkill: crud.create,
    updateSkill: crud.update,
    deleteSkill: crud.deleteItem,
    setCurrentSkill: crud.setCurrentItem,
    clearSkills: crud.clearItems,
    clearError: crud.clearError
  }
})
```

- [ ] **Step 3: 提交**

```bash
git add frontend/src/api/skill.js frontend/src/stores/skillStore.js
git commit -m "feat: add skill API client and store"
```

---

## Task 8: 创建 SkillConfig.vue 视图

**Files:**
- Create: `frontend/src/views/SkillConfig.vue`
- Modify: `frontend/src/router/index.js`

- [ ] **Step 1: 创建 SkillConfig.vue**

创建完整的 Skill 管理界面组件，包含：
- Skill 列表展示
- 创建 Skill（输入名称、描述）
- 上传 zip 包解压
- 预览/编辑文件
- 删除 Skill

- [ ] **Step 2: 添加路由**

在 `frontend/src/router/index.js` 添加 SkillConfig 路由

- [ ] **Step 3: 测试界面功能**

手动测试各项功能

- [ ] **Step 4: 提交**

```bash
git add frontend/src/views/SkillConfig.vue frontend/src/router/index.js
git commit -m "feat: add skill management UI"
```

---

## Task 9: 端到端测试

- [ ] **Step 1: 启动后端**

运行: `cd backend && npm run dev`

- [ ] **Step 2: 测试 API**

```bash
# 创建 skill
curl -X POST http://localhost:8000/api/skills -H "Content-Type: application/json" -d '{"name":"test-skill","description":"test"}'

# 列出 skills
curl http://localhost:8000/api/skills

# 删除 skill
curl -X DELETE http://localhost:8000/api/skills/1
```

- [ ] **Step 3: 端到端验证**

1. 前端上传一个 skill zip 包
2. 创建关联该 skill 的 Agent
3. 启动 Workflow
4. 检查项目 `.claude/skills/` 目录是否包含 skill

---

## Self-Review Checklist

- [ ] **Spec coverage:** 所有需求都有对应 task 实现
- [ ] **Placeholder scan:** 无 TBD/TODO 占位符
- [ ] **Type consistency:** 类型、方法名一致
- [ ] **Testability:** 每个后端组件都有单元测试

---

**Plan complete and saved to `docs/superpowers/plans/2026-03-28-skill-management.md`**

Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
