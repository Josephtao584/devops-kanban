// Pure visibility predicates for the workflow loop action buttons.
//
// Extracted from CurrentWorkflow.vue so the boundary conditions can be unit-
// tested without mounting the component. The backend's createLoopRun rejects
// when `parent.iteration + 1 > maxLoops`, which is the source of truth — keep
// these predicates aligned with that rule.

/**
 * Resolve the failed step id for a workflow run that ended in FAILED state.
 * Prefers an explicit FAILED step over the run's `current_step` pointer.
 */
function failedStepIdOf(run) {
  if (!run) return null
  const failed = (run.steps || []).find(s => s?.status === 'FAILED')
  return failed?.step_id || run.current_step || null
}

/**
 * "回退到…" — manual loop-back. Surfaces only when the failed step has no
 * auto-loop wired (i.e. no template-level onFailureLoopTo). When auto-loop is
 * configured, the runtime fires it automatically and the manual button would
 * just duplicate that path.
 *
 * Falls back to "show" if we can't identify the failed step or the template
 * snapshot is missing — the backend will validate the request either way, and
 * hiding the button on missing data trapped users into an unreachable state.
 */
export function canLoopBack(run) {
  if (!run) return false
  if (run.status !== 'FAILED') return false
  const failedStepId = failedStepIdOf(run)
  if (!failedStepId) return true
  const templateSteps = run.workflow_template_snapshot?.steps || []
  const tplStep = templateSteps.find(s => (s.id || s.step_id) === failedStepId)
  // No template step found ⇒ assume manual loop-back is fine; backend
  // re-validates. tplStep present but onFailureLoopTo is null ⇒ also manual.
  return !tplStep?.onFailureLoopTo
}

/**
 * "再循环一轮" — override the auto-loop budget. Surfaces when the failed run
 * has hit the configured ceiling so the user can opt into one more iteration.
 *
 * Boundary: `iteration >= maxLoops` (not strictly greater). Backend rejects
 * when `parent.iteration + 1 > maxLoops`, so once iteration matches maxLoops
 * the next auto-loop would be rejected and override is the only path forward.
 *
 * Special case: maxLoops <= 0 means auto-loop is disabled entirely; every
 * loop attempt is by definition a manual override, so always show the button
 * on FAILED runs.
 */
export function canLoopAgain(run) {
  if (!run) return false
  if (run.status !== 'FAILED') return false
  const maxLoops = Number(run.workflow_template_snapshot?.maxLoops ?? 0)
  const iteration = Number(run.iteration ?? 1)
  if (maxLoops <= 0) return true
  return iteration >= maxLoops
}
