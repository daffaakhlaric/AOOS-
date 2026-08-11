import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { ActiveLeadCount } from "../value-objects/ActiveLeadCount.js";
import type { BranchId } from "../value-objects/BranchId.js";
import { DailyLeadCount } from "../value-objects/DailyLeadCount.js";
import type { MaxLeadsPerDay } from "../value-objects/MaxLeadsPerDay.js";
import type { SalesHumanId } from "../value-objects/SalesHumanId.js";
import { SalesStatus } from "../value-objects/SalesStatus.js";

export interface SalesHumanProps {
  readonly id: SalesHumanId;
  readonly name: string;
  readonly waNumber: string;
  readonly branchId: BranchId;
  readonly status: SalesStatus;
  readonly maxLeadsPerDay: MaxLeadsPerDay;
  readonly activeLeadCount: ActiveLeadCount;
  readonly todayLeadCount: DailyLeadCount;
  readonly joinedAt: Date;
  readonly lastActiveAt?: Date;
}

/** A branch's sales team member — the assignment target for every lead. Immutable: every state change (status transition, lead-count increment) produces a new instance. */
export class SalesHuman {
  private constructor(private readonly props: SalesHumanProps) {}

  static create(props: SalesHumanProps): Result<SalesHuman, ValidationError> {
    if (typeof props.name !== "string" || props.name.trim().length === 0) {
      return err(new ValidationError("SalesHuman.name must be a non-empty string"));
    }
    if (typeof props.waNumber !== "string" || props.waNumber.trim().length === 0) {
      return err(new ValidationError("SalesHuman.waNumber must be a non-empty string"));
    }
    if (!Object.values(SalesStatus).includes(props.status)) {
      return err(new ValidationError(`SalesHuman.status is invalid: ${String(props.status)}`));
    }
    if (
      props.lastActiveAt !== undefined &&
      props.lastActiveAt.getTime() < props.joinedAt.getTime()
    ) {
      return err(new ValidationError("SalesHuman.lastActiveAt must not precede joinedAt"));
    }
    return ok(new SalesHuman({ ...props }));
  }

  get id(): SalesHumanId {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get waNumber(): string {
    return this.props.waNumber;
  }

  get branchId(): BranchId {
    return this.props.branchId;
  }

  get status(): SalesStatus {
    return this.props.status;
  }

  get maxLeadsPerDay(): MaxLeadsPerDay {
    return this.props.maxLeadsPerDay;
  }

  get activeLeadCount(): ActiveLeadCount {
    return this.props.activeLeadCount;
  }

  get todayLeadCount(): DailyLeadCount {
    return this.props.todayLeadCount;
  }

  get joinedAt(): Date {
    return this.props.joinedAt;
  }

  get lastActiveAt(): Date | undefined {
    return this.props.lastActiveAt;
  }

  /** `status === ON && todayLeadCount < maxLeadsPerDay` — the sole eligibility check every assignment strategy filters on. */
  get isAvailable(): boolean {
    return (
      this.props.status === SalesStatus.ON &&
      this.props.todayLeadCount.toNumber() < this.props.maxLeadsPerDay.toNumber()
    );
  }

  /** `maxLeadsPerDay - todayLeadCount`, floored at 0. */
  get capacityRemaining(): number {
    return Math.max(0, this.props.maxLeadsPerDay.toNumber() - this.props.todayLeadCount.toNumber());
  }

  /** Immutable status transition — used by `AvailabilityService.updateStatus`. */
  withStatus(status: SalesStatus, at: Date): SalesHuman {
    return new SalesHuman({ ...this.props, status, lastActiveAt: at });
  }

  /** Immutable "a lead was just assigned" transition — increments both counters. Used by `LeadAssignmentService`. */
  withIncrementedLeadCounts(at: Date): SalesHuman {
    return new SalesHuman({
      ...this.props,
      activeLeadCount: this.props.activeLeadCount.increment(),
      todayLeadCount: this.props.todayLeadCount.increment(),
      lastActiveAt: at,
    });
  }

  /** Immutable "today's quota window reset" transition — used by `AvailabilityService.resetDailyCounts`. */
  withResetDailyCount(): SalesHuman {
    return new SalesHuman({ ...this.props, todayLeadCount: DailyLeadCount.zero() });
  }
}
