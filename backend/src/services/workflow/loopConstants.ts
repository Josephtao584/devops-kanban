/**
 * System-wide cap on auto-loop iterations. Per Tao's spec on 2026-05-18,
 * max-loops is no longer per-template configurable — every workflow gets 3
 * automatic rollback attempts before the user must manually override.
 */
export const DEFAULT_MAX_LOOPS = 3;
