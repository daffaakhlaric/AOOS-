import type { StressTestMode } from "./stress-test-run.js";

/**
 * Creative Stress Test, Second Boundary — real OpenAI-call cost/latency bounding per the brief's
 * hard constraint ("cap persona/evaluator counts by mode as specified, don't add extra unbounded
 * LLM calls"). A run's `personaIds` may hold up to 5 real preset ids (all 5 personas exist), but
 * `execute()` only ever simulates the FIRST `MODE_PERSONA_CAP[mode]` of them — never more, no
 * matter how many were selected.
 */
export const MODE_PERSONA_CAP: Readonly<Record<StressTestMode, number>> = {
  FAST: 1,
  STANDARD: 3,
  DEEP: 5,
};
