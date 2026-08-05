/** Interface only — no implementation in this package. An external pluggable metrics sink the Middleware Pipeline's Metrics step may forward samples to. */
export interface IKnowledgeProviderMetrics {
  increment(name: string, value?: number): void;
}
