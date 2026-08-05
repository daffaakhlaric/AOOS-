import type { KnowledgeProviderCapabilityFlag } from "../domain/knowledge-provider-capability-flag.js";
import type { KnowledgeProviderCategory } from "../domain/knowledge-provider-category.js";

export interface KnowledgeProviderMetricsSnapshot {
  readonly providerCount: number;
  readonly providerUsage: Readonly<Record<string, number>>;
  readonly providerCategory: Readonly<Record<KnowledgeProviderCategory, number>>;
  readonly capabilityUsage: Readonly<Record<KnowledgeProviderCapabilityFlag, number>>;
  readonly workspaceUsage: Readonly<Record<string, number>>;
  readonly tenantUsage: Readonly<Record<string, number>>;
  readonly failureCount: number;
  readonly healthCount: number;
  readonly registrationCount: number;
}

/**
 * "METRICS: Provider Count, Provider Usage, Provider Category, Capability Usage,
 * Workspace Usage, Tenant Usage, Failure Count, Health Count, Registration Count."
 * (docs/PROMPT-005.7F-KNOWLEDGE-PROVIDER.md). Named `...Collector` to avoid colliding
 * with `contracts/i-knowledge-provider-metrics.ts`'s `IKnowledgeProviderMetrics` — that
 * one is the Extension Point for an external pluggable metrics sink; this one is the
 * internal collector `KnowledgeProviderMetrics` implements.
 */
export interface IKnowledgeProviderMetricsCollector {
  recordProviderRegistered(providerId: string): void;
  recordProviderUsage(providerId: string): void;
  recordProviderCategory(category: KnowledgeProviderCategory): void;
  recordCapabilityUsage(flag: KnowledgeProviderCapabilityFlag): void;
  recordWorkspaceUsage(workspaceId: string): void;
  recordTenantUsage(tenantId: string): void;
  recordFailure(): void;
  recordHealthCheck(): void;
  setProviderCount(count: number): void;
  snapshot(): KnowledgeProviderMetricsSnapshot;
}
