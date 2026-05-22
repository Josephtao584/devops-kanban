#!/usr/bin/env node
// Stress test: create one project + N tasks, run workflows at fixed concurrency,
// while hammering read-only endpoints at a target RPS. Prints per-second stats.
//
// Usage:
//   node scripts/stress-test.mjs \
//     --baseUrl=http://localhost:8000 \
//     --tasks=50 \
//     --concurrency=3 \
//     --rps=5 \
//     --duration=600 \
//     --templateId=<workflow_template_id> \
//     --localPath=/abs/path/to/some/git/repo \
//     [--gitUrl=https://github.com/foo/bar.git]
//
// Notes:
// - If --templateId is omitted, the script fetches /api/workflow-template and
//   uses the first one.
// - One of --localPath or --gitUrl must be provided so worktrees can be created.
// - Ctrl+C stops dispatch and waits up to 30s for in-flight workflows.

import { setTimeout as sleep } from 'node:timers/promises';

// ---------- args ----------
function parseArgs(argv) {
  const out = {};
  for (const a of argv.slice(2)) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (!m) continue;
    out[m[1]] = m[2] ?? 'true';
  }
  return out;
}

const args = parseArgs(process.argv);
const cfg = {
  baseUrl: args.baseUrl || 'http://localhost:8000',
  tasks: Number(args.tasks ?? 50),
  concurrency: Number(args.concurrency ?? 3),
  rps: Number(args.rps ?? 5),
  durationSec: Number(args.duration ?? 600),
  templateId: args.templateId || null,
  localPath: args.localPath || null,
  gitUrl: args.gitUrl || null,
  projectName: args.projectName || `stress-${new Date().toISOString().replace(/[:.]/g, '-')}`,
  pollIntervalMs: Number(args.pollIntervalMs ?? 2000),
  workflowTimeoutSec: Number(args.workflowTimeoutSec ?? 600),
};

if (!cfg.localPath && !cfg.gitUrl) {
  console.error('error: --localPath or --gitUrl is required (worktrees need a source repo)');
  process.exit(1);
}

// ---------- http ----------
async function http(method, path, body, { timeoutMs = 15000 } = {}) {
  const url = `${cfg.baseUrl}${path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const ms = Date.now() - t0;
    let json = null;
    try { json = await res.json(); } catch { /* ignore non-JSON */ }
    return { ok: res.ok, status: res.status, ms, body: json };
  } catch (err) {
    return { ok: false, status: 0, ms: Date.now() - t0, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

function unwrap(resp, label) {
  if (!resp.ok || !resp.body?.success) {
    throw new Error(`${label} failed: status=${resp.status} ${resp.error || resp.body?.error || ''}`);
  }
  return resp.body.data;
}

// ---------- setup ----------
async function pickTemplateId() {
  if (cfg.templateId) return cfg.templateId;
  const resp = await http('GET', '/api/workflow-template');
  const list = unwrap(resp, 'GET /api/workflow-template');
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('No workflow templates available; pass --templateId=<id>');
  }
  console.log(`[setup] picked template "${list[0].id}" (${list[0].name})`);
  return list[0].id;
}

async function createProject() {
  const body = {
    name: cfg.projectName,
    description: 'created by stress-test.mjs',
  };
  if (cfg.gitUrl) body.git_url = cfg.gitUrl;
  if (cfg.localPath) body.local_path = cfg.localPath;
  const resp = await http('POST', '/api/projects', body);
  const project = unwrap(resp, 'POST /api/projects');
  console.log(`[setup] project ${project.id}: ${project.name}`);
  return project;
}

async function createTasks(projectId, n) {
  const created = [];
  for (let i = 0; i < n; i++) {
    const resp = await http('POST', '/api/tasks', {
      project_id: projectId,
      title: `stress-task-${i + 1}`,
      description: `auto-generated stress task ${i + 1}/${n}`,
      status: 'TODO',
      priority: 'MEDIUM',
    });
    const t = unwrap(resp, `POST /api/tasks #${i + 1}`);
    created.push(t);
    if ((i + 1) % 10 === 0) console.log(`[setup] created ${i + 1}/${n} tasks`);
  }
  return created;
}

// ---------- workflow dispatch ----------
const TERMINAL_STATUSES = new Set(['COMPLETED', 'SUCCESS', 'FAILED', 'CANCELLED', 'ERROR']);

const stats = {
  startedAt: Date.now(),
  workflows: { dispatched: 0, completed: 0, failed: 0, timedOut: 0, dispatchError: 0 },
  queries: { total: 0, ok: 0, fail: 0, latSamples: [] },
};

async function startWorkflowForTask(taskId, templateId) {
  const resp = await http('POST', `/api/tasks/${taskId}/start`, {
    workflow_template_id: templateId,
  });
  if (!resp.ok || !resp.body?.success) {
    stats.workflows.dispatchError++;
    return { ok: false, reason: resp.body?.error || resp.error || `status=${resp.status}` };
  }
  stats.workflows.dispatched++;
  return { ok: true, data: resp.body.data };
}

async function pollWorkflowUntilDone(taskId, deadlineMs) {
  while (Date.now() < deadlineMs && !shuttingDown) {
    const resp = await http('GET', `/api/workflows/runs?task_id=${taskId}`);
    if (resp.ok && resp.body?.success && Array.isArray(resp.body.data)) {
      const runs = resp.body.data;
      const latest = runs[runs.length - 1];
      if (latest && TERMINAL_STATUSES.has(String(latest.status).toUpperCase())) {
        return { status: latest.status };
      }
    }
    await sleep(cfg.pollIntervalMs);
  }
  return { status: 'TIMEOUT' };
}

async function workflowWorker(taskQueue, templateId, workerId) {
  while (taskQueue.length > 0 && !shuttingDown) {
    const task = taskQueue.shift();
    const start = await startWorkflowForTask(task.id, templateId);
    if (!start.ok) {
      console.warn(`[wf-${workerId}] task ${task.id} dispatch failed: ${start.reason}`);
      continue;
    }
    const deadline = Date.now() + cfg.workflowTimeoutSec * 1000;
    const result = await pollWorkflowUntilDone(task.id, deadline);
    const status = String(result.status).toUpperCase();
    if (status === 'COMPLETED' || status === 'SUCCESS') stats.workflows.completed++;
    else if (status === 'TIMEOUT') stats.workflows.timedOut++;
    else stats.workflows.failed++;
  }
}

// ---------- query load ----------
const QUERY_BUILDERS = [
  () => ['GET', '/health'],
  () => ['GET', '/api/projects'],
  (ctx) => ['GET', `/api/projects/${ctx.projectId}`],
  (ctx) => ['GET', `/api/tasks?project_id=${ctx.projectId}`],
  (ctx) => ['GET', `/api/tasks/${pickTaskId(ctx)}`],
  (ctx) => ['GET', `/api/tasks/${pickTaskId(ctx)}/pipeline`],
  (ctx) => ['GET', `/api/workflows/runs?task_id=${pickTaskId(ctx)}`],
  () => ['GET', '/api/workflow-template'],
  () => ['GET', '/api/agents'],
];

function pickTaskId(ctx) {
  return ctx.taskIds[Math.floor(Math.random() * ctx.taskIds.length)];
}

function startQueryLoop(ctx) {
  if (cfg.rps <= 0) return null;
  const intervalMs = Math.max(1, Math.round(1000 / cfg.rps));
  const handle = setInterval(async () => {
    if (shuttingDown) return;
    const builder = QUERY_BUILDERS[Math.floor(Math.random() * QUERY_BUILDERS.length)];
    const [method, path] = builder(ctx);
    const resp = await http(method, path, null, { timeoutMs: 10_000 });
    stats.queries.total++;
    if (resp.ok && resp.body?.success !== false) stats.queries.ok++;
    else stats.queries.fail++;
    if (stats.queries.latSamples.length < 1000) stats.queries.latSamples.push(resp.ms);
  }, intervalMs);
  return handle;
}

// ---------- stats printer ----------
function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

let lastQueryTotal = 0;
function startStatsPrinter() {
  return setInterval(() => {
    const upSec = Math.round((Date.now() - stats.startedAt) / 1000);
    const sorted = [...stats.queries.latSamples].sort((a, b) => a - b);
    const p50 = percentile(sorted, 50);
    const p95 = percentile(sorted, 95);
    const p99 = percentile(sorted, 99);
    const dq = stats.queries.total - lastQueryTotal;
    lastQueryTotal = stats.queries.total;
    const wf = stats.workflows;
    console.log(
      `[t+${String(upSec).padStart(4)}s] ` +
      `wf disp=${wf.dispatched} done=${wf.completed} fail=${wf.failed} timeout=${wf.timedOut} dispErr=${wf.dispatchError} | ` +
      `query total=${stats.queries.total} (+${dq}/s) ok=${stats.queries.ok} fail=${stats.queries.fail} ` +
      `p50=${p50}ms p95=${p95}ms p99=${p99}ms`
    );
    // Trim sample buffer so percentiles reflect recent traffic, not start-of-run.
    if (stats.queries.latSamples.length > 500) {
      stats.queries.latSamples.splice(0, stats.queries.latSamples.length - 500);
    }
  }, 1000);
}

// ---------- shutdown ----------
let shuttingDown = false;
process.on('SIGINT', () => {
  if (shuttingDown) return;
  console.log('\n[stress] SIGINT — stopping dispatch, waiting for in-flight workflows…');
  shuttingDown = true;
});

// ---------- main ----------
async function main() {
  console.log('[stress] config:', cfg);
  const templateId = await pickTemplateId();
  const project = await createProject();
  const tasks = await createTasks(project.id, cfg.tasks);
  console.log(`[setup] all ${tasks.length} tasks created. Starting load…`);

  const ctx = { projectId: project.id, taskIds: tasks.map((t) => t.id) };
  const queryHandle = startQueryLoop(ctx);
  const statsHandle = startStatsPrinter();

  // Auto-stop after duration
  const stopTimer = setTimeout(() => {
    if (!shuttingDown) {
      console.log(`\n[stress] duration ${cfg.durationSec}s reached — stopping`);
      shuttingDown = true;
    }
  }, cfg.durationSec * 1000);

  const queue = [...tasks];
  const workers = Array.from({ length: cfg.concurrency }, (_, i) =>
    workflowWorker(queue, templateId, i + 1)
  );

  await Promise.all(workers);

  // Drain phase: keep query load running for a few seconds after all workflows done
  if (!shuttingDown) {
    console.log('[stress] all workflows finished — draining query load for 10s');
    await sleep(10_000);
  }

  if (queryHandle) clearInterval(queryHandle);
  clearInterval(statsHandle);
  clearTimeout(stopTimer);

  console.log('\n[stress] final stats:');
  console.log(JSON.stringify({
    runtimeSec: Math.round((Date.now() - stats.startedAt) / 1000),
    project: { id: project.id, name: project.name },
    workflows: stats.workflows,
    queries: { total: stats.queries.total, ok: stats.queries.ok, fail: stats.queries.fail },
  }, null, 2));
  console.log(`\n[stress] project "${project.name}" (id=${project.id}) left in DB for inspection.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[stress] fatal:', err);
  process.exit(1);
});
