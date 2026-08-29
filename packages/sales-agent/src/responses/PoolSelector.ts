/**
 * Deterministic response-pool selection (design resolution #4): the spec's prose says Clara
 * "picks + slightly varies" from pools like `GREETING_POOL`, which read literally as
 * `Math.random()`-driven — incompatible with the package's hard "NO LLM calls... all responses
 * deterministic rule-based" constraint and its 100%-coverage testability requirement. Every pool
 * picker below instead takes an integer `seed` (in practice, the conversation's
 * `inboundMessageCount` — see `LeadConversation.inboundMessageCount`) and derives an index via
 * simple modulo, so the same conversation state always produces the same response and tests can
 * assert an exact expected string.
 */
export function pickFromPool<T>(pool: ReadonlyArray<T>, seed: number): T {
  const index = Math.abs(Math.trunc(seed)) % pool.length;
  return pool[index]!;
}
