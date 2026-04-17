import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { WorkflowTemplateService } from '../../src/services/workflow/workflowTemplateService.js';
import { closeDbClient } from '../../src/db/client.js';
import { initDatabase } from '../../src/db/schema.js';

async function withIsolatedStorage(run: () => Promise<void>) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-template-validation-test-'));
  process.env.STORAGE_PATH = tempRoot;
  await closeDbClient();
  await initDatabase();
  try {
    await run();
  } finally {
    await closeDbClient();
    delete process.env.STORAGE_PATH;
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

const validStep = {
  id: 'step-1',
  name: 'Explore',
  instructionPrompt: 'Do something useful.',
  agentId: 1,
};

const longStepName = {
  id: 'step-2',
  name: 'a'.repeat(201),
  instructionPrompt: 'Do something.',
  agentId: 1,
};

const longTemplateName = 't'.repeat(201);
const exactTemplateName = 't'.repeat(200);

// ─── createTemplate() validation ─────────────────────────

test.test('createTemplate rejects template name exceeding 200 characters', async () => {
  await withIsolatedStorage(async () => {
    const service = new WorkflowTemplateService();
    await assert.rejects(
      async () => service.createTemplate({
        template_id: 'test-template',
        name: longTemplateName,
        steps: [validStep],
      }),
      /Workflow template name exceeds maximum length of 200 characters/
    );
  });
});

test.test('createTemplate accepts template name at exactly 200 characters', async () => {
  await withIsolatedStorage(async () => {
    const service = new WorkflowTemplateService();
    const template = await service.createTemplate({
      template_id: 'test-template',
      name: exactTemplateName,
      steps: [validStep],
    });
    assert.equal(template.name, exactTemplateName);
  });
});

test.test('createTemplate rejects step name exceeding 200 characters', async () => {
  await withIsolatedStorage(async () => {
    const service = new WorkflowTemplateService();
    await assert.rejects(
      async () => service.createTemplate({
        template_id: 'test-template',
        name: 'Valid Template',
        steps: [longStepName],
      }),
      /step name must not exceed 200 characters/
    );
  });
});

test.test('createTemplate accepts step name at exactly 200 characters', async () => {
  await withIsolatedStorage(async () => {
    const service = new WorkflowTemplateService();
    const validLongStep = {
      id: 'step-1',
      name: 'a'.repeat(200),
      instructionPrompt: 'Do something useful.',
      agentId: 1,
    };
    const template = await service.createTemplate({
      template_id: 'test-template',
      name: 'Valid Template',
      steps: [validLongStep],
    });
    assert.equal(template.steps[0]!.name, 'a'.repeat(200));
  });
});

// ─── updateTemplate() validation ─────────────────────────

test.test('updateTemplate rejects step name exceeding 200 characters', async () => {
  await withIsolatedStorage(async () => {
    const service = new WorkflowTemplateService();
    await service.createTemplate({
      template_id: 'test-template',
      name: 'Valid Template',
      steps: [validStep],
    });

    await assert.rejects(
      async () => service.updateTemplate('test-template', {
        steps: [longStepName],
      }),
      /step name must not exceed 200 characters/
    );
  });
});
