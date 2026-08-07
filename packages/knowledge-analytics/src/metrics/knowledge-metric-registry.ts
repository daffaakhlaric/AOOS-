import { MetricNotFoundException } from "../errors/metric-not-found-exception.js";
import type { KnowledgeMetricDefinition } from "../value-objects/knowledge-metric-definition.js";

/** An entry stored in the registry: a metric's static definition plus its latest computed value. */
export interface KnowledgeMetricRegistryEntry {
  readonly definition: KnowledgeMetricDefinition;
  readonly currentValue: number;
  readonly updatedAt: number;
}

/**
 * Id-keyed registry of metric definitions and their most-recently-calculated values. Lookups are
 * `Map.get` — no scanning. Analytics services register their owned metric definitions here on
 * construction and push updated values whenever they recompute (e.g. after `recordSearch`).
 */
export class KnowledgeMetricRegistry {
  private readonly entries = new Map<string, KnowledgeMetricRegistryEntry>();

  register(definition: KnowledgeMetricDefinition): void {
    this.entries.set(definition.id, {
      definition,
      currentValue: 0,
      updatedAt: 0,
    });
  }

  isRegistered(id: string): boolean {
    return this.entries.has(id);
  }

  updateValue(id: string, value: number, updatedAt: number): void {
    const existing = this.entries.get(id);
    if (!existing) throw new MetricNotFoundException(id);
    this.entries.set(id, { definition: existing.definition, currentValue: value, updatedAt });
  }

  get(id: string): KnowledgeMetricRegistryEntry {
    const entry = this.entries.get(id);
    if (!entry) throw new MetricNotFoundException(id);
    return entry;
  }

  tryGet(id: string): KnowledgeMetricRegistryEntry | undefined {
    return this.entries.get(id);
  }

  unregister(id: string): boolean {
    return this.entries.delete(id);
  }

  list(): readonly KnowledgeMetricRegistryEntry[] {
    return [...this.entries.values()];
  }

  size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }
}
