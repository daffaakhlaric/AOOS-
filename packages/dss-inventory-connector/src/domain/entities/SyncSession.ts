import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { SourceSystem } from "../value-objects/SourceSystem.js";

export type SyncSessionStatus = "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED";

export interface SyncSessionProps {
  readonly id: string;
  readonly triggeredAt: Date;
  readonly completedAt?: Date;
  readonly sources: ReadonlyArray<SourceSystem>;
  readonly unitsAdded: number;
  readonly unitsUpdated: number;
  readonly unitsSold: number;
  readonly errors: ReadonlyArray<string>;
  readonly status: SyncSessionStatus;
}

const VALID_STATUSES: ReadonlyArray<SyncSessionStatus> = [
  "RUNNING",
  "COMPLETED",
  "PARTIAL",
  "FAILED",
];

/** One sync run's metadata — created `RUNNING` via `start`, transitioned to a terminal status via `complete`. */
export class SyncSession {
  private constructor(private readonly props: SyncSessionProps) {}

  static create(props: SyncSessionProps): Result<SyncSession, ValidationError> {
    if (typeof props.id !== "string" || props.id.trim().length === 0) {
      return err(new ValidationError("SyncSession.id must be a non-empty string"));
    }
    if (!VALID_STATUSES.includes(props.status)) {
      return err(new ValidationError(`SyncSession.status is invalid: ${String(props.status)}`));
    }
    if (props.unitsAdded < 0 || props.unitsUpdated < 0 || props.unitsSold < 0) {
      return err(new ValidationError("SyncSession unit counts must not be negative"));
    }
    return ok(
      new SyncSession({
        ...props,
        sources: [...props.sources],
        errors: [...props.errors],
      }),
    );
  }

  /** A fresh `RUNNING` session for the given `sources`. */
  static start(id: string, sources: ReadonlyArray<SourceSystem>, triggeredAt: Date): SyncSession {
    return new SyncSession({
      id,
      triggeredAt,
      sources: [...sources],
      unitsAdded: 0,
      unitsUpdated: 0,
      unitsSold: 0,
      errors: [],
      status: "RUNNING",
    });
  }

  get id(): string {
    return this.props.id;
  }

  get triggeredAt(): Date {
    return this.props.triggeredAt;
  }

  get completedAt(): Date | undefined {
    return this.props.completedAt;
  }

  get sources(): ReadonlyArray<SourceSystem> {
    return this.props.sources;
  }

  get unitsAdded(): number {
    return this.props.unitsAdded;
  }

  get unitsUpdated(): number {
    return this.props.unitsUpdated;
  }

  get unitsSold(): number {
    return this.props.unitsSold;
  }

  get errors(): ReadonlyArray<string> {
    return this.props.errors;
  }

  get status(): SyncSessionStatus {
    return this.props.status;
  }

  /** Transitions this `RUNNING` session to a terminal outcome, returning a new instance. */
  complete(outcome: {
    readonly unitsAdded: number;
    readonly unitsUpdated: number;
    readonly unitsSold: number;
    readonly errors: ReadonlyArray<string>;
    readonly status: Exclude<SyncSessionStatus, "RUNNING">;
    readonly completedAt: Date;
  }): SyncSession {
    return new SyncSession({
      ...this.props,
      ...outcome,
      errors: [...outcome.errors],
    });
  }
}
