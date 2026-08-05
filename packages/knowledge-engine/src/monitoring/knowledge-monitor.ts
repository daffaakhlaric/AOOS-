import type { KnowledgeHealthReport, HealthStatus } from "../health/i-health-check.js";
import { KnowledgeHealth } from "../health/knowledge-health.js";
import type {
  IKnowledgeMetrics,
  KnowledgeMetricsSnapshot,
} from "../metrics/i-knowledge-metrics.js";
import type { KnowledgeRegistry } from "../registry/knowledge-registry.js";
import type { KnowledgeRepository } from "../repository/knowledge-repository.js";

/** "MONITORING: Knowledge Dashboard, Workspace Dashboard, Policy Dashboard, Relationship Dashboard, Version Dashboard, Tenant Dashboard, Validation Dashboard." (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md) — one combined sample carrying all 7 named sections. */
export interface KnowledgeDashboard {
  readonly knowledge: { readonly count: number; readonly documentCount: number };
  readonly workspace: { readonly count: number };
  readonly policy: { readonly count: number };
  readonly relationship: { readonly count: number };
  readonly version: { readonly count: number };
  readonly tenant: { readonly usage: Readonly<Record<string, number>> };
  readonly validation: { readonly errors: number; readonly status: HealthStatus };
  readonly health: KnowledgeHealthReport;
  readonly metrics: KnowledgeMetricsSnapshot;
  readonly sampledAt: string;
}

/** Combines Metrics + Health into one sampled `KnowledgeDashboard` snapshot. */
export class KnowledgeMonitor {
  readonly health: KnowledgeHealth;

  constructor(
    private readonly metrics: IKnowledgeMetrics,
    repository: KnowledgeRepository,
    registry: KnowledgeRegistry,
  ) {
    this.health = new KnowledgeHealth(repository, registry, () => this.metrics.snapshot());
  }

  sample(): KnowledgeDashboard {
    const metrics = this.metrics.snapshot();
    const health = this.health.check();
    return {
      knowledge: { count: metrics.knowledgeCount, documentCount: metrics.documentCount },
      workspace: { count: metrics.workspaceCount },
      policy: { count: metrics.policyCount },
      relationship: { count: metrics.relationshipCount },
      version: { count: metrics.versionCount },
      tenant: { usage: metrics.tenantUsage },
      validation: { errors: metrics.validationErrors, status: health.validation.status },
      health,
      metrics,
      sampledAt: new Date().toISOString(),
    };
  }
}
