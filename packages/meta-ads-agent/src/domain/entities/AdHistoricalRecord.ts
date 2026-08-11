import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import type { Branch, Funnel } from "@aos/meta-ads-connector";

import type { AdAngle } from "../value-objects/AdAngle.js";
import type { EvergreenScore } from "../value-objects/EvergreenScore.js";

/**
 * One ad's aggregated 90-day historical performance record — AAOS-W1D-S1S2 (S1).
 *
 * Spec-consistency note: the spec's "New Value Objects" list also names
 * `domain/value-objects/AdHistoricalRecord.ts`, but its "New Domain Entity" section separately
 * shows the actual `interface AdHistoricalRecord {...}` body once, under
 * `domain/entities/AdHistoricalRecord.ts`. This is a spec listing duplication, not two distinct
 * types — built ONCE here, in `domain/entities/`, matching where the real interface body was
 * given. No `domain/value-objects/AdHistoricalRecord.ts` file exists.
 */
export interface AdHistoricalRecordProps {
  readonly adId: string;
  readonly adName: string;
  readonly branch: Branch;
  readonly funnel: Funnel;
  readonly angle: AdAngle;
  readonly daysActive: number;
  readonly avgRphD3: number;
  readonly avgRphChat: number;
  readonly avgFrequency: number;
  readonly totalSpend: number;
  readonly totalD3: number;
  readonly fatigueCount: number;
  readonly evergreenScore: EvergreenScore;
}

export class AdHistoricalRecord {
  private constructor(private readonly props: AdHistoricalRecordProps) {}

  static create(props: AdHistoricalRecordProps): Result<AdHistoricalRecord, ValidationError> {
    if (typeof props.adId !== "string" || props.adId.trim().length === 0) {
      return err(new ValidationError("AdHistoricalRecord.adId must be a non-empty string"));
    }
    if (!Number.isFinite(props.daysActive) || props.daysActive < 0) {
      return err(
        new ValidationError("AdHistoricalRecord.daysActive must be a non-negative number"),
      );
    }
    if (!Number.isFinite(props.totalSpend) || props.totalSpend < 0) {
      return err(
        new ValidationError("AdHistoricalRecord.totalSpend must be a non-negative number"),
      );
    }
    return ok(new AdHistoricalRecord({ ...props }));
  }

  get adId(): string {
    return this.props.adId;
  }

  get adName(): string {
    return this.props.adName;
  }

  get branch(): Branch {
    return this.props.branch;
  }

  get funnel(): Funnel {
    return this.props.funnel;
  }

  get angle(): AdAngle {
    return this.props.angle;
  }

  get daysActive(): number {
    return this.props.daysActive;
  }

  get avgRphD3(): number {
    return this.props.avgRphD3;
  }

  get avgRphChat(): number {
    return this.props.avgRphChat;
  }

  get avgFrequency(): number {
    return this.props.avgFrequency;
  }

  get totalSpend(): number {
    return this.props.totalSpend;
  }

  get totalD3(): number {
    return this.props.totalD3;
  }

  get fatigueCount(): number {
    return this.props.fatigueCount;
  }

  get evergreenScore(): EvergreenScore {
    return this.props.evergreenScore;
  }

  /** Active > 60 days AND still healthy (`EvergreenScore >= 70`) — per spec "New Domain Entity". */
  get isEvergreen(): boolean {
    return this.props.daysActive > 60 && this.props.evergreenScore.isHealthy();
  }
}
