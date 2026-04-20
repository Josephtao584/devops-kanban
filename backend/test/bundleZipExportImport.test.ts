import { describe, it, mock } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import AdmZip from 'adm-zip';
import { BundleService } from '../src/services/bundleService.js';
import { ValidationError } from '../src/utils/errors.js';
import type { WorkflowTemplateEntity, AgentEntity, SkillEntity, McpServerEntity } from '../src/types/entities.js';
import { ExecutorType } from '../src/types/executors.js';
import type { BundleExportFile } from '../src/types/dto/bundle.js';

// --- Mock factories (same as bundleExportImport.test.ts) ---

function createMockTemplateRepo(templates: WorkflowTemplateEntity[] = []) {
  const store = new Map(templates.map(t => [t.template_id, t]));
  return {
    findAll: mock.fn(async () => [...store.values()]),
    findByTemplateId: mock.fn(async (id: string) => store.get(id) || null),
    findById: mock.fn(async (id: number) => [...store.values()].find(t => t.id === id) || null),
    create: mock.fn(async (data: Record<string, unknown>) => {
      const newId = Math.max(0, ...[...store.values()].map(t => t.id)) + 1;
      const entity = { ...data, id: newId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as WorkflowTemplateEntity;
      store.set(entity.template_id, entity);
      return entity;
    }),
    update: mock.fn(async (id: number, data: Record<string, unknown>) => {
      const existing = [...store.values()].find(t => t.id === id);
      if (!existing) return null;
      const updated = { ...existing, ...data, updated_at: new Date().toISOString() } as WorkflowTemplateEntity;
      store.set(updated.template_id, updated);
      return updated;
    }),
    delete: mock.fn(async (id: number) => {
      const existing = [...store.values()].find(t => t.id === id);
      if (!existing) return false;
      store.delete(existing.template_id);
      return true;
    }),
  };
}

function createMockAgentRepo(agents: AgentEntity[] = []) {
  const store = new Map(agents.map(a => [a.id, a]));
  return {
    findAll: mock.fn(async () => [...store.values()]),
    findById: mock.fn(async (id: number) => store.get(id) || null),
    create: mock.fn(async (data: Record<string, unknown>) => {
      const newId = Math.max(0, ...[...store.values()].map(a => a.id)) + 1;
      const entity = { ...data, id: newId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as AgentEntity;
      store.set(entity.id, entity);
      return entity;
    }),
    update: mock.fn(async (id: number, data: Record<string, unknown>) => {
      const existing = store.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...data, updated_at: new Date().toISOString() } as AgentEntity;
      store.set(updated.id, updated);
      return updated;
    }),
  };
}

function createMockSkillRepo(skills: SkillEntity[] = []) {
  const store = new Map(skills.map(s => [s.id, s]));
  return {
    findAll: mock.fn(async () => [...store.values()]),
    findById: mock.fn(async (id: number) => store.get(id) || null),
    create: mock.fn(async (data: Record<string, unknown>) => {
      const newId = Math.max(0, ...[...store.values()].map(s => s.id)) + 1;
      const entity = { ...data, id: newId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as SkillEntity;
      store.set(entity.id, entity);
      return entity;
    }),
    update: mock.fn(async (id: number, data: Record<string, unknown>) => {
      const existing = store.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...data, updated_at: new Date().toISOString() } as SkillEntity;
      store.set(updated.id, updated);
      return updated;
    }),
  };
}

function createMockMcpServerRepo(servers: McpServerEntity[] = []) {
  const store = new Map(servers.map(s => [s.id, s]));
  return {
    findAll: mock.fn(async () => [...store.values()]),
    findById: mock.fn(async (id: number) => store.get(id) || null),
    create: mock.fn(async (data: Record<string, unknown>) => {
      const newId = Math.max(0, ...[...store.values()].map(s => s.id)) + 1;
      const entity = { ...data, id: newId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as McpServerEntity;
      store.set(entity.id, entity);
      return entity;
    }),
    update: mock.fn(async (id: number, data: Record<string, unknown>) => {
      const existing = store.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...data, updated_at: new Date().toISOString() } as McpServerEntity;
      store.set(updated.id, updated);
      return updated;
    }),
  };
}

// --- Test data ---

const skillGit: SkillEntity = {
  id: 1, identifier: 'git', name: 'Git', description: 'Git version control',
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
};

const agentAnalyst: AgentEntity = {
  id: 1, name: '分析师', executorType: ExecutorType.CLAUDE_CODE, role: 'analyzer',
  description: 'Analyzes code', enabled: true,
  skills: [1], mcpServers: [], env: {},
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
};

const template1: WorkflowTemplateEntity = {
  id: 1, template_id: 'cve-fix', name: 'CVE 漏洞修复',
  steps: [
    { id: 's1', name: '分析', instructionPrompt: 'Analyze', agentId: 1, requiresConfirmation: false },
  ],
  order: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
};

// --- Helpers ---

async function withTempDir(run: (dir: string) => Promise<void>) {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'bundle-zip-test-'));
  try {
    await run(dir);
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
}

function createService(
  templateData: WorkflowTemplateEntity[] = [],
  agentData: AgentEntity[] = [],
  skillData: SkillEntity[] = [],
  mcpData: McpServerEntity[] = [],
  storagePath?: string,
) {
  const templateRepo = createMockTemplateRepo(templateData);
  const agentRepo = createMockAgentRepo(agentData);
  const skillRepo = createMockSkillRepo(skillData);
  const mcpServerRepo = createMockMcpServerRepo(mcpData);
  const service = new BundleService({
    // @ts-expect-error mock repos
    templateRepo,
    // @ts-expect-error mock repos
    agentRepo,
    // @ts-expect-error mock repos
    skillRepo,
    // @ts-expect-error mock repos
    mcpServerRepo,
    storagePath,
  });
  return { service, templateRepo, agentRepo, skillRepo, mcpServerRepo };
}

// --- Tests ---

describe('BundleService - exportBundleAsZipBuffer', () => {
  it('should produce a valid ZIP containing bundle.json', async () => {
    await withTempDir(async (tmp) => {
      const { service } = createService([template1], [agentAnalyst], [skillGit], [], tmp);

      const zipBuffer = await service.exportBundleAsZipBuffer({
        templateIds: ['cve-fix'],
        agentNames: ['分析师'],
        skillIdentifiers: ['git'],
        mcpServerNames: [],
      });

      const zip = new AdmZip(zipBuffer);
      const bundleEntry = zip.getEntry('bundle.json');
      assert.ok(bundleEntry, 'ZIP should contain bundle.json');

      const bundle: BundleExportFile = JSON.parse(bundleEntry!.getData().toString('utf-8'));
      assert.equal(bundle.version, '2.1');
      assert.equal(bundle.templates.length, 1);
      assert.equal(bundle.templates[0]!.template_id, 'cve-fix');
      assert.equal(bundle.agents.length, 1);
      assert.equal(bundle.skills.length, 1);
    });
  });

  it('should include skill files in the ZIP', async () => {
    await withTempDir(async (tmp) => {
      // Create a skill directory with files
      const skillDir = path.join(tmp, 'skills', 'git');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: Git\n---\nGit skill content');
      fs.writeFileSync(path.join(skillDir, 'instructions.md'), 'Use git commands');

      const { service } = createService([template1], [agentAnalyst], [skillGit], [], tmp);

      const zipBuffer = await service.exportBundleAsZipBuffer({
        templateIds: ['cve-fix'],
        agentNames: ['分析师'],
        skillIdentifiers: ['git'],
        mcpServerNames: [],
      });

      const zip = new AdmZip(zipBuffer);
      const skillMd = zip.getEntry('skills/git/SKILL.md');
      const instructionsMd = zip.getEntry('skills/git/instructions.md');

      assert.ok(skillMd, 'ZIP should contain skills/git/SKILL.md');
      assert.ok(instructionsMd, 'ZIP should contain skills/git/instructions.md');
      assert.equal(skillMd!.getData().toString('utf-8'), '---\nname: Git\n---\nGit skill content');
      assert.equal(instructionsMd!.getData().toString('utf-8'), 'Use git commands');
    });
  });

  it('should handle skill with no files on disk gracefully', async () => {
    await withTempDir(async (tmp) => {
      // No skill directory created on disk
      const { service } = createService([template1], [agentAnalyst], [skillGit], [], tmp);

      const zipBuffer = await service.exportBundleAsZipBuffer({
        templateIds: ['cve-fix'],
        agentNames: ['分析师'],
        skillIdentifiers: ['git'],
        mcpServerNames: [],
      });

      const zip = new AdmZip(zipBuffer);
      const bundleEntry = zip.getEntry('bundle.json');
      assert.ok(bundleEntry);

      const bundle: BundleExportFile = JSON.parse(bundleEntry!.getData().toString('utf-8'));
      // Skill metadata still in bundle.json even though files don't exist
      assert.equal(bundle.skills.length, 1);

      // No skill file entries in ZIP
      const skillEntries = zip.getEntries().filter(e => e.entryName.startsWith('skills/'));
      assert.equal(skillEntries.length, 0);
    });
  });

  it('should include skill files in nested subdirectories', async () => {
    await withTempDir(async (tmp) => {
      const skillDir = path.join(tmp, 'skills', 'git');
      const subDir = path.join(skillDir, 'prompts');
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), 'Git skill');
      fs.writeFileSync(path.join(subDir, 'review.md'), 'Review prompt');

      const { service } = createService([template1], [agentAnalyst], [skillGit], [], tmp);

      const zipBuffer = await service.exportBundleAsZipBuffer({
        templateIds: ['cve-fix'],
        agentNames: ['分析师'],
        skillIdentifiers: ['git'],
        mcpServerNames: [],
      });

      const zip = new AdmZip(zipBuffer);
      assert.ok(zip.getEntry('skills/git/SKILL.md'));
      assert.ok(zip.getEntry('skills/git/prompts/review.md'));
    });
  });
});

describe('BundleService - previewImportFromZip', () => {
  it('should extract bundle.json from ZIP and return preview', async () => {
    await withTempDir(async (tmp) => {
      const { service } = createService([], [], [], [], tmp);

      // Build a test ZIP
      const zip = new AdmZip();
      const bundleData: BundleExportFile = {
        version: '2.1',
        exportedAt: new Date().toISOString(),
        templates: [{ template_id: 'test-tpl', name: 'Test', steps: [] }],
        agents: [{ name: 'TestAgent', executorType: 'claude-code', role: 'dev', enabled: true, skillNames: [], mcpServerNames: [] }],
        skills: [{ identifier: 'test-skill', name: 'Test Skill' }],
        mcpServers: [],
      };
      zip.addFile('bundle.json', Buffer.from(JSON.stringify(bundleData)));
      const zipBuffer = zip.toBuffer();

      const preview = await service.previewImportFromZip(zipBuffer);

      assert.equal(preview.templates.length, 1);
      assert.equal(preview.agents.length, 1);
      assert.equal(preview.skills.length, 1);
      assert.deepEqual(preview.conflicts.templateIds, []);
    });
  });

  it('should detect conflicts with existing entities', async () => {
    await withTempDir(async (tmp) => {
      const { service } = createService([template1], [agentAnalyst], [skillGit], [], tmp);

      const zip = new AdmZip();
      const bundleData: BundleExportFile = {
        version: '2.1',
        exportedAt: new Date().toISOString(),
        templates: [{ template_id: 'cve-fix', name: 'CVE', steps: [] }],
        agents: [{ name: '分析师', executorType: 'claude-code', role: 'analyzer', enabled: true, skillNames: [], mcpServerNames: [] }],
        skills: [{ identifier: 'git', name: 'Git' }],
        mcpServers: [],
      };
      zip.addFile('bundle.json', Buffer.from(JSON.stringify(bundleData)));

      const preview = await service.previewImportFromZip(zip.toBuffer());

      assert.deepEqual(preview.conflicts.templateIds, ['cve-fix']);
      assert.deepEqual(preview.conflicts.agentNames, ['分析师']);
      assert.deepEqual(preview.conflicts.skillIdentifiers, ['git']);
    });
  });

  it('should throw ValidationError when ZIP has no bundle.json', async () => {
    await withTempDir(async (tmp) => {
      const { service } = createService([], [], [], [], tmp);

      const zip = new AdmZip();
      zip.addFile('readme.txt', Buffer.from('no bundle here'));
      const zipBuffer = zip.toBuffer();

      await assert.rejects(
        () => service.previewImportFromZip(zipBuffer),
        (error: unknown) => {
          assert.ok(error instanceof ValidationError);
          return true;
        },
      );
    });
  });
});

describe('BundleService - confirmImportFromZip', () => {
  it('should import entities and extract skill files to disk', async () => {
    await withTempDir(async (tmp) => {
      const { service } = createService([], [], [], [], tmp);

      const zip = new AdmZip();
      const bundleData: BundleExportFile = {
        version: '2.1',
        exportedAt: new Date().toISOString(),
        templates: [{
          template_id: 'new-tpl', name: 'New Template',
          steps: [{ id: 's1', name: 'Step1', instructionPrompt: 'Do', agentName: 'NewAgent' }],
        }],
        agents: [{
          name: 'NewAgent', executorType: 'claude-code', role: 'dev',
          enabled: true, skillNames: ['new-skill'], mcpServerNames: [],
        }],
        skills: [{ identifier: 'new-skill', name: 'New Skill' }],
        mcpServers: [],
      };
      zip.addFile('bundle.json', Buffer.from(JSON.stringify(bundleData)));
      zip.addFile('skills/new-skill/SKILL.md', Buffer.from('---\nname: New Skill\n---\nContent'));
      zip.addFile('skills/new-skill/prompts/hello.md', Buffer.from('Hello prompt'));
      const zipBuffer = zip.toBuffer();

      const result = await service.confirmImportFromZip(zipBuffer, 'skip');

      assert.equal(result.imported.skills, 1);
      assert.equal(result.imported.agents, 1);
      assert.equal(result.imported.templates, 1);

      // Verify skill files were written to disk
      const skillMd = fs.readFileSync(path.join(tmp, 'skills', 'new-skill', 'SKILL.md'), 'utf-8');
      assert.equal(skillMd, '---\nname: New Skill\n---\nContent');
      const promptMd = fs.readFileSync(path.join(tmp, 'skills', 'new-skill', 'prompts', 'hello.md'), 'utf-8');
      assert.equal(promptMd, 'Hello prompt');
    });
  });

  it('should skip skill identifiers containing path traversal', async () => {
    await withTempDir(async (tmp) => {
      const { service } = createService([], [], [], [], tmp);

      const zip = new AdmZip();
      const bundleData: BundleExportFile = {
        version: '2.1',
        exportedAt: new Date().toISOString(),
        templates: [],
        agents: [],
        skills: [{ identifier: '../etc', name: 'Evil' }],
        mcpServers: [],
      };
      zip.addFile('bundle.json', Buffer.from(JSON.stringify(bundleData)));
      zip.addFile('skills/../etc/passwd', Buffer.from('root:x:0:0'));
      const zipBuffer = zip.toBuffer();

      const result = await service.confirmImportFromZip(zipBuffer, 'skip');

      // Skill metadata still imported (it's valid in confirmImport)
      assert.equal(result.imported.skills, 1);
      // But no file should exist outside skills dir
      assert.ok(!fs.existsSync(path.join(tmp, 'passwd')));
      assert.ok(!fs.existsSync(path.join(tmp, 'etc')));
    });
  });

  it('should skip ZIP entries with path traversal in relative path', async () => {
    await withTempDir(async (tmp) => {
      const { service } = createService([], [], [], [], tmp);

      const zip = new AdmZip();
      const bundleData: BundleExportFile = {
        version: '2.1',
        exportedAt: new Date().toISOString(),
        templates: [],
        agents: [],
        skills: [{ identifier: 'safe-skill', name: 'Safe' }],
        mcpServers: [],
      };
      zip.addFile('bundle.json', Buffer.from(JSON.stringify(bundleData)));
      // Entry with path traversal
      zip.addFile('skills/safe-skill/../../escape.txt', Buffer.from('escaped'));
      zip.addFile('skills/safe-skill/normal.txt', Buffer.from('normal content'));
      const zipBuffer = zip.toBuffer();

      await service.confirmImportFromZip(zipBuffer, 'skip');

      // Normal file should be extracted
      assert.ok(fs.existsSync(path.join(tmp, 'skills', 'safe-skill', 'normal.txt')));
      // Path traversal file should NOT be extracted
      assert.ok(!fs.existsSync(path.join(tmp, 'escape.txt')));
    });
  });

  it('should import with overwrite strategy', async () => {
    await withTempDir(async (tmp) => {
      const existingSkill: SkillEntity = {
        id: 1, identifier: 'git', name: 'Git', description: 'Old',
        created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
      };
      const { service, skillRepo } = createService([], [], [existingSkill], [], tmp);

      const zip = new AdmZip();
      const bundleData: BundleExportFile = {
        version: '2.1',
        exportedAt: new Date().toISOString(),
        templates: [],
        agents: [],
        skills: [{ identifier: 'git', name: 'Git', description: 'New' }],
        mcpServers: [],
      };
      zip.addFile('bundle.json', Buffer.from(JSON.stringify(bundleData)));
      zip.addFile('skills/git/SKILL.md', Buffer.from('Updated content'));
      const zipBuffer = zip.toBuffer();

      const result = await service.confirmImportFromZip(zipBuffer, 'overwrite');

      assert.equal(result.imported.skills, 1);
      const updated = (await skillRepo.findAll())[0]!;
      assert.equal(updated.description, 'New');

      // Skill file should be written
      assert.ok(fs.existsSync(path.join(tmp, 'skills', 'git', 'SKILL.md')));
    });
  });

  it('should import with copy strategy creating unique names', async () => {
    await withTempDir(async (tmp) => {
      const existingSkill: SkillEntity = {
        id: 1, identifier: 'git', name: 'Git',
        created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
      };
      const { service, skillRepo } = createService([], [], [existingSkill], [], tmp);

      const zip = new AdmZip();
      const bundleData: BundleExportFile = {
        version: '2.1',
        exportedAt: new Date().toISOString(),
        templates: [],
        agents: [],
        skills: [{ identifier: 'git', name: 'Git' }],
        mcpServers: [],
      };
      zip.addFile('bundle.json', Buffer.from(JSON.stringify(bundleData)));
      // Note: copy strategy creates skill with new name, so skill files won't match
      const zipBuffer = zip.toBuffer();

      const result = await service.confirmImportFromZip(zipBuffer, 'copy');

      assert.equal(result.imported.skills, 1);
      const allSkills = await skillRepo.findAll();
      assert.equal(allSkills.length, 2);
      assert.ok(allSkills.some(s => s.identifier === 'git-copy'));
    });
  });

  it('should handle ZIP with no skill files (metadata only)', async () => {
    await withTempDir(async (tmp) => {
      const { service } = createService([], [], [], [], tmp);

      const zip = new AdmZip();
      const bundleData: BundleExportFile = {
        version: '2.1',
        exportedAt: new Date().toISOString(),
        templates: [],
        agents: [],
        skills: [{ identifier: 'empty-skill', name: 'Empty Skill' }],
        mcpServers: [],
      };
      zip.addFile('bundle.json', Buffer.from(JSON.stringify(bundleData)));
      // No skill files in the ZIP
      const zipBuffer = zip.toBuffer();

      const result = await service.confirmImportFromZip(zipBuffer, 'skip');

      assert.equal(result.imported.skills, 1);
      // No skill directory should be created
      assert.ok(!fs.existsSync(path.join(tmp, 'skills', 'empty-skill')));
    });
  });

  it('should throw ValidationError when ZIP has no bundle.json', async () => {
    await withTempDir(async (tmp) => {
      const { service } = createService([], [], [], [], tmp);

      const zip = new AdmZip();
      zip.addFile('readme.txt', Buffer.from('no bundle'));
      const zipBuffer = zip.toBuffer();

      await assert.rejects(
        () => service.confirmImportFromZip(zipBuffer, 'skip'),
        (error: unknown) => {
          assert.ok(error instanceof ValidationError);
          return true;
        },
      );
    });
  });
});

describe('BundleService - ZIP round-trip (export then import)', () => {
  it('should produce a ZIP that can be imported back correctly', async () => {
    await withTempDir(async (tmp) => {
      // Setup: create skill files on disk
      const skillDir = path.join(tmp, 'skills', 'git');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: Git\n---\nGit skill');

      // Export
      const exportService = createService(
        [template1], [agentAnalyst], [skillGit], [], tmp,
      );
      const zipBuffer = await exportService.service.exportBundleAsZipBuffer({
        templateIds: ['cve-fix'],
        agentNames: ['分析师'],
        skillIdentifiers: ['git'],
        mcpServerNames: [],
      });

      // Import into a fresh environment
      const importTmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'bundle-import-'));
      try {
        const importService = createService([], [], [], [], importTmp);
        const result = await importService.service.confirmImportFromZip(zipBuffer, 'skip');

        assert.equal(result.imported.skills, 1);
        assert.equal(result.imported.agents, 1);
        assert.equal(result.imported.templates, 1);

        // Verify skill file was extracted
        const skillMd = fs.readFileSync(path.join(importTmp, 'skills', 'git', 'SKILL.md'), 'utf-8');
        assert.equal(skillMd, '---\nname: Git\n---\nGit skill');
      } finally {
        await fs.promises.rm(importTmp, { recursive: true, force: true });
      }
    });
  });
});
