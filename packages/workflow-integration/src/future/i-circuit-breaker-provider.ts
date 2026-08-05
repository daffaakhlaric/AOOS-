/** "Circuit Breaker Provider — No implementation." (docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md — "FUTURE READY"). */
export type CircuitBreakerState = "closed" | "open" | "half_open";

export interface ICircuitBreakerProvider {
  state(adapterName: string): Promise<CircuitBreakerState>;
  recordSuccess(adapterName: string): Promise<void>;
  recordFailure(adapterName: string): Promise<void>;
}
