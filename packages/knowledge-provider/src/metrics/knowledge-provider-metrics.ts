import { KnowledgeProviderCapabilityFlag } from "../domain/knowledge-provider-capability-flag.js";
import { KnowledgeProviderCategory } from "../domain/knowledge-provider-category.js";

import type {
  IKnowledgeProviderMetricsCollector,
  KnowledgeProviderMetricsSnapshot,
} from "./i-knowledge-provider-metrics.js";

function emptyProviderCategory(): Record<KnowledgeProviderCategory, number> {
  const count = {} as Record<KnowledgeProviderCategory, number>;
  for (const category of Object.values(KnowledgeProviderCategory)) {
    count[category] = 0;
  }
  return count;
}

function emptyCapabilityUsage(): Record<KnowledgeProviderCapabilityFlag, number> {
  const count = {} as Record<KnowledgeProviderCapabilityFlag, number>;
  for (const flag of Object.values(KnowledgeProviderCapabilityFlag)) {
    count[flag] = 0;
  }
  return count;
}

export class KnowledgeProviderMetrics implements IKnowledgeProviderMetricsCollector {
  private providerCount = 0;
  private failureCount = 0;
  private healthCount = 0;
  private registrationCount = 0;
  private readonly providerUsage = new Map<string, number>();
  private readonly providerCategory = emptyProviderCategory();
  private readonly capabilityUsage = emptyCapabilityUsage();
  private readonly workspaceUsage = new Map<string, number>();
  private readonly tenantUsage = new Map<string, number>();

  recordProviderRegistered(_providerId: string): void {
    this.registrationCount += 1;
  }

  recordProviderUsage(providerId: string): void {
    this.providerUsage.set(providerId, (this.providerUsage.get(providerId) ?? 0) + 1);
  }

  recordProviderCategory(category: KnowledgeProviderCategory): void {
    this.providerCategory[category] += 1;
  }

  recordCapabilityUsage(flag: KnowledgeProviderCapabilityFlag): void {
    this.capabilityUsage[flag] += 1;
  }

  recordWorkspaceUsage(workspaceId: string): void {
    this.workspaceUsage.set(workspaceId, (this.workspaceUsage.get(workspaceId) ?? 0) + 1);
  }

  recordTenantUsage(tenantId: string): void {
    this.tenantUsage.set(tenantId, (this.tenantUsage.get(tenantId) ?? 0) + 1);
  }

  recordFailure(): void {
    this.failureCount += 1;
  }

  recordHealthCheck(): void {
    this.healthCount += 1;
  }

  setProviderCount(count: number): void {
    this.providerCount = count;
  }

  snapshot(): KnowledgeProviderMetricsSnapshot {
    return {
      providerCount: this.providerCount,
      providerUsage: Object.fromEntries(this.providerUsage),
      providerCategory: { ...this.providerCategory },
      capabilityUsage: { ...this.capabilityUsage },
      workspaceUsage: Object.fromEntries(this.workspaceUsage),
      tenantUsage: Object.fromEntries(this.tenantUsage),
      failureCount: this.failureCount,
      healthCount: this.healthCount,
      registrationCount: this.registrationCount,
    };
  }
}
