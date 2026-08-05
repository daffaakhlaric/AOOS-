import type { KnowledgeProviderHealthReport } from "../health/i-health-check.js";
import { KnowledgeProviderHealth } from "../health/knowledge-provider-health.js";
import type {
  IKnowledgeProviderMetricsCollector,
  KnowledgeProviderMetricsSnapshot,
} from "../metrics/i-knowledge-provider-metrics.js";
import type { KnowledgeProviderRegistry } from "../registry/knowledge-provider-registry.js";

/** "MONITORING: Provider Dashboard, Capability Dashboard, Health Dashboard, Workspace Dashboard, Tenant Dashboard, Category Dashboard, Usage Dashboard." (docs/PROMPT-005.7F-KNOWLEDGE-PROVIDER.md) — one combined sample carrying all 7 named sections. */
export interface KnowledgeProviderDashboard {
  readonly provider: { readonly count: number; readonly usage: Readonly<Record<string, number>> };
  readonly capability: { readonly usage: Readonly<Record<string, number>> };
  readonly health: KnowledgeProviderHealthReport;
  readonly workspace: { readonly usage: Readonly<Record<string, number>> };
  readonly tenant: { readonly usage: Readonly<Record<string, number>> };
  readonly category: { readonly usage: Readonly<Record<string, number>> };
  readonly usage: { readonly registrationCount: number; readonly failureCount: number };
  readonly metrics: KnowledgeProviderMetricsSnapshot;
  readonly sampledAt: string;
}

/** Combines Metrics + Health into one sampled `KnowledgeProviderDashboard` snapshot. */
export class KnowledgeProviderMonitor {
  readonly health: KnowledgeProviderHealth;

  constructor(
    private readonly metrics: IKnowledgeProviderMetricsCollector,
    registry: KnowledgeProviderRegistry,
  ) {
    this.health = new KnowledgeProviderHealth(registry, () => this.metrics.snapshot());
  }

  sample(): KnowledgeProviderDashboard {
    const metrics = this.metrics.snapshot();
    const health = this.health.check();
    return {
      provider: { count: metrics.providerCount, usage: metrics.providerUsage },
      capability: { usage: metrics.capabilityUsage },
      health,
      workspace: { usage: metrics.workspaceUsage },
      tenant: { usage: metrics.tenantUsage },
      category: { usage: metrics.providerCategory },
      usage: { registrationCount: metrics.registrationCount, failureCount: metrics.failureCount },
      metrics,
      sampledAt: new Date().toISOString(),
    };
  }
}
