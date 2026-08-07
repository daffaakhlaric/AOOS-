import { KnowledgeDashboardSnapshot } from "../reports/knowledge-dashboard-snapshot.js";
import type { Clock } from "../types/common.js";
import { systemClock } from "../utils/clock.js";
import { generateId } from "../utils/id-generator.js";

/** Optional overrides accepted by {@link KnowledgeDashboardSnapshotFactory.create}. */
export interface CreateDashboardSnapshotOptions {
  readonly id?: string;
  readonly generatedAt?: number;
  readonly metrics: Readonly<Record<string, number>>;
}

/** Real Factory-pattern class for constructing {@link KnowledgeDashboardSnapshot} with sensible defaults. */
export class KnowledgeDashboardSnapshotFactory {
  private readonly clock: Clock;

  constructor(clock: Clock = systemClock) {
    this.clock = clock;
  }

  create(options: CreateDashboardSnapshotOptions): KnowledgeDashboardSnapshot {
    return new KnowledgeDashboardSnapshot({
      id: options.id ?? generateId("dashboard"),
      generatedAt: options.generatedAt ?? this.clock(),
      metrics: options.metrics,
    });
  }
}
