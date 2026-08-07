import { KnowledgeMetricName } from "../types/metric-name.js";

import {
  BaseKnowledgeAnalyticsService,
  type BaseKnowledgeAnalyticsServiceOptions,
} from "./base-knowledge-analytics-service.js";

/**
 * Owns: Document Count, Indexed Count, Deleted Count, Storage Usage, Knowledge Usage, Provider Usage.
 */
export class KnowledgeUsageAnalytics extends BaseKnowledgeAnalyticsService {
  constructor(options: BaseKnowledgeAnalyticsServiceOptions = {}) {
    super(options);
  }

  recordDocumentAdded(count = 1): void {
    this.record(KnowledgeMetricName.DocumentCount, count);
    this.publish(KnowledgeMetricName.DocumentCount, this.documentCount());
  }

  documentCount(): number {
    return this.calculator.sum(this.valuesFor(KnowledgeMetricName.DocumentCount));
  }

  recordDocumentIndexed(count = 1): void {
    this.record(KnowledgeMetricName.IndexedCount, count);
    this.publish(KnowledgeMetricName.IndexedCount, this.indexedCount());
  }

  indexedCount(): number {
    return this.calculator.sum(this.valuesFor(KnowledgeMetricName.IndexedCount));
  }

  recordDocumentDeleted(count = 1): void {
    this.record(KnowledgeMetricName.DeletedCount, count);
    this.publish(KnowledgeMetricName.DeletedCount, this.deletedCount());
  }

  deletedCount(): number {
    return this.calculator.sum(this.valuesFor(KnowledgeMetricName.DeletedCount));
  }

  recordStorageUsage(bytes: number): void {
    this.record(KnowledgeMetricName.StorageUsage, bytes);
    this.publish(KnowledgeMetricName.StorageUsage, this.currentStorageUsage());
  }

  /** Most recently recorded storage usage reading (a gauge, not a running total). */
  currentStorageUsage(): number {
    const values = this.valuesFor(KnowledgeMetricName.StorageUsage);
    return values.length === 0 ? 0 : values[values.length - 1]!;
  }

  recordKnowledgeUsage(knowledgeId: string, count = 1): void {
    this.record(KnowledgeMetricName.KnowledgeUsage, count, { knowledgeId });
    this.publish(KnowledgeMetricName.KnowledgeUsage, this.totalKnowledgeUsage());
  }

  knowledgeUsage(knowledgeId: string): number {
    return this.aggregateByTag(KnowledgeMetricName.KnowledgeUsage, "knowledgeId")[knowledgeId] ?? 0;
  }

  knowledgeUsageByKnowledge(): Readonly<Record<string, number>> {
    return this.aggregateByTag(KnowledgeMetricName.KnowledgeUsage, "knowledgeId");
  }

  totalKnowledgeUsage(): number {
    return this.calculator.sum(this.valuesFor(KnowledgeMetricName.KnowledgeUsage));
  }

  recordProviderUsage(providerId: string, count = 1): void {
    this.record(KnowledgeMetricName.ProviderUsage, count, { providerId });
    this.publish(KnowledgeMetricName.ProviderUsage, this.totalProviderUsage());
  }

  providerUsage(providerId: string): number {
    return this.aggregateByTag(KnowledgeMetricName.ProviderUsage, "providerId")[providerId] ?? 0;
  }

  providerUsageByProvider(): Readonly<Record<string, number>> {
    return this.aggregateByTag(KnowledgeMetricName.ProviderUsage, "providerId");
  }

  totalProviderUsage(): number {
    return this.calculator.sum(this.valuesFor(KnowledgeMetricName.ProviderUsage));
  }

  summary(): Readonly<Record<string, unknown>> {
    return {
      documentCount: this.documentCount(),
      indexedCount: this.indexedCount(),
      deletedCount: this.deletedCount(),
      currentStorageUsage: this.currentStorageUsage(),
      totalKnowledgeUsage: this.totalKnowledgeUsage(),
      totalProviderUsage: this.totalProviderUsage(),
    };
  }
}
