// Pure visibility predicates for the workflow loop action buttons.
//
// Extracted from CurrentWorkflow.vue so the boundary conditions can be unit-
// tested without mounting the component. The backend's createLoopRun rejects
// when `parent.iteration + 1 > DEFAULT_MAX_LOOPS`, which is the source of
// truth — keep these predicates aligned with that rule.

/**
 * System-wide cap on auto-loop iterations. This MUST match
 * `DEFAULT_MAX_LOOPS` in backend/src/services/workflow/loopConstants.ts.
 * Duplicated here so the UI can compute "再循环一轮" visibility without an
 * extra round-trip — the backend remains the source of truth for actual
 * enforcement.
 */
export const DEFAULT_MAX_LOOPS = 3

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
 * Boundary: `iteration >= DEFAULT_MAX_LOOPS` (not strictly greater). Backend
 * rejects when `parent.iteration + 1 > DEFAULT_MAX_LOOPS`, so once iteration
 * matches the cap the next auto-loop would be rejected and override is the
 * only path forward.
 */
export function canLoopAgain(run) {
  if (!run) return false
  if (run.status !== 'FAILED') return false
  const iteration = Number(run.iteration ?? 1)
  return iteration >= DEFAULT_MAX_LOOPS
}
