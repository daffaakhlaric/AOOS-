import type { BranchId } from "../value-objects/BranchId.js";
import type { FollowUpDay } from "../value-objects/FollowUpDay.js";
import type { LeadTemperature } from "../value-objects/LeadTemperature.js";

export interface FollowUpEntry {
  readonly day: FollowUpDay;
  readonly scheduledAt: Date;
}

export interface FollowUpScheduleProps {
  readonly leadPhone: string;
  readonly branchId: BranchId;
  readonly temperature: LeadTemperature;
  readonly entries: ReadonlyArray<FollowUpEntry>;
}

/** A lead's D3/D7/D14 (COLD) or D1/D3/D7 (WARM) follow-up plan, built by `FollowUpScheduleBuilder`. Immutable. */
export class FollowUpSchedule {
  private constructor(private readonly props: FollowUpScheduleProps) {}

  static create(props: FollowUpScheduleProps): FollowUpSchedule {
    return new FollowUpSchedule({ ...props, entries: [...props.entries] });
  }

  get leadPhone(): string {
    return this.props.leadPhone;
  }

  get branchId(): BranchId {
    return this.props.branchId;
  }

  get temperature(): LeadTemperature {
    return this.props.temperature;
  }

  get entries(): ReadonlyArray<FollowUpEntry> {
    return this.props.entries;
  }

  /** The next not-yet-elapsed entry, relative to `now`; `undefined` once all entries have elapsed. */
  nextEntry(now: Date): FollowUpEntry | undefined {
    return this.props.entries.find((entry) => entry.scheduledAt.getTime() > now.getTime());
  }
}
