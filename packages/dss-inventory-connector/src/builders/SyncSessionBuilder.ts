import type { Result } from "@aos/common";
import type { ValidationError } from "@aos/errors";

import { SyncSession, type SyncSessionStatus } from "../domain/entities/SyncSession.js";
import type { SourceSystem } from "../domain/value-objects/SourceSystem.js";

/** Fluent builder (Builder Pattern) for `SyncSession`, for test fixtures and any composition code that wants a hand-constructed session. */
export class SyncSessionBuilder {
  private id = "sync-session-1";
  private triggeredAt = new Date("2026-01-01T00:00:00.000Z");
  private completedAt: Date | undefined;
  private sources: SourceSystem[] = [];
  private unitsAdded = 0;
  private unitsUpdated = 0;
  private unitsSold = 0;
  private errors: string[] = [];
  private status: SyncSessionStatus = "RUNNING";

  withId(id: string): this {
    this.id = id;
    return this;
  }

  withTriggeredAt(at: Date): this {
    this.triggeredAt = at;
    return this;
  }

  withCompletedAt(at: Date): this {
    this.completedAt = at;
    return this;
  }

  withSources(sources: SourceSystem[]): this {
    this.sources = sources;
    return this;
  }

  withUnitsAdded(count: number): this {
    this.unitsAdded = count;
    return this;
  }

  withUnitsUpdated(count: number): this {
    this.unitsUpdated = count;
    return this;
  }

  withUnitsSold(count: number): this {
    this.unitsSold = count;
    return this;
  }

  withErrors(errors: string[]): this {
    this.errors = errors;
    return this;
  }

  withStatus(status: SyncSessionStatus): this {
    this.status = status;
    return this;
  }

  build(): Result<SyncSession, ValidationError> {
    return SyncSession.create({
      id: this.id,
      triggeredAt: this.triggeredAt,
      completedAt: this.completedAt,
      sources: this.sources,
      unitsAdded: this.unitsAdded,
      unitsUpdated: this.unitsUpdated,
      unitsSold: this.unitsSold,
      errors: this.errors,
      status: this.status,
    });
  }
}
