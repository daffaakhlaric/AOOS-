import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { LeadId } from "../value-objects/LeadId.js";
import type { ScoreReason } from "../value-objects/ScoreReason.js";

export interface ScoringEventProps {
  readonly id: string;
  readonly leadId: LeadId;
  readonly scoreBefore: number;
  readonly scoreAfter: number;
  readonly delta: number;
  readonly reason: ScoreReason;
  readonly triggeredBy?: string;
  readonly createdAt: Date;
}

/** One immutable audit record of a lead's score changing (spec table `scoring_events`) — `scoreAfter` is always the already-clamped `[0, 100]` value (design resolution #6). */
export class ScoringEvent {
  private constructor(private readonly props: ScoringEventProps) {}

  static create(props: ScoringEventProps): Result<ScoringEvent, ValidationError> {
    if (props.scoreAfter < 0 || props.scoreAfter > 100) {
      return err(
        new ValidationError(
          `ScoringEvent.scoreAfter must be within [0, 100], received: ${props.scoreAfter}`,
        ),
      );
    }
    if (props.scoreBefore < 0 || props.scoreBefore > 100) {
      return err(
        new ValidationError(
          `ScoringEvent.scoreBefore must be within [0, 100], received: ${props.scoreBefore}`,
        ),
      );
    }
    return ok(new ScoringEvent({ ...props }));
  }

  get id(): string {
    return this.props.id;
  }

  get leadId(): LeadId {
    return this.props.leadId;
  }

  get scoreBefore(): number {
    return this.props.scoreBefore;
  }

  get scoreAfter(): number {
    return this.props.scoreAfter;
  }

  get delta(): number {
    return this.props.delta;
  }

  get reason(): ScoreReason {
    return this.props.reason;
  }

  get triggeredBy(): string | undefined {
    return this.props.triggeredBy;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
