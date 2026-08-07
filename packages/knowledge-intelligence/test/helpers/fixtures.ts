import type { KnowledgeItemSnapshot } from "../../src/types/knowledge-item.js";
import { ManualClock } from "../../src/utils/clock.js";
import { resetIdCounters } from "../../src/utils/id-generator.js";
import { KnowledgeIntelligenceConfiguration } from "../../src/value-objects/knowledge-intelligence-configuration.js";

export function resetFixtureState(): void {
  resetIdCounters();
}

export function makeClock(startAt = 1_000_000): ManualClock {
  return new ManualClock(startAt);
}

export function makeConfig(): KnowledgeIntelligenceConfiguration {
  return KnowledgeIntelligenceConfiguration.default();
}

let counter = 0;

export function makeItem(overrides: Partial<KnowledgeItemSnapshot> = {}): KnowledgeItemSnapshot {
  counter += 1;
  return {
    id: overrides.id ?? `item-${counter}`,
    title: overrides.title ?? `Item ${counter}`,
    category: overrides.category,
    tags: overrides.tags ?? ["alpha", "beta"],
    keywords: overrides.keywords,
    vector: overrides.vector,
    contentLength: overrides.contentLength ?? 100,
    requiredFieldsPresent: overrides.requiredFieldsPresent ?? 4,
    requiredFieldsTotal: overrides.requiredFieldsTotal ?? 4,
    lastUpdatedAt: overrides.lastUpdatedAt ?? 1_000_000,
    createdAt: overrides.createdAt ?? 1_000_000,
    viewCount: overrides.viewCount,
    linkedItemIds: overrides.linkedItemIds,
    conflictsWith: overrides.conflictsWith,
    hasOwner: overrides.hasOwner ?? true,
    hasSummary: overrides.hasSummary ?? true,
    hasExamples: overrides.hasExamples ?? true,
    metadata: overrides.metadata,
  };
}

export function resetItemCounter(): void {
  counter = 0;
}
