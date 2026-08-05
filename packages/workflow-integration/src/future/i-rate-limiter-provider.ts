/** "Rate Limiter Provider — No implementation." (docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md — "FUTURE READY"). */
export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly retryAfterMs?: number;
}

export interface IRateLimiterProvider {
  tryAcquire(adapterName: string, tenantId?: string): Promise<RateLimitDecision>;
}
