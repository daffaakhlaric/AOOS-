import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

export interface HistoricalPeriodProps {
  readonly from: Date;
  readonly to: Date;
  readonly days: number;
}

/** The lookback window `HistoricalLearningService.learn()` pulled data over — AAOS-W1D-S1S2 (S1). */
export class HistoricalPeriod {
  private constructor(private readonly props: HistoricalPeriodProps) {}

  static create(props: HistoricalPeriodProps): Result<HistoricalPeriod, ValidationError> {
    if (props.to.getTime() < props.from.getTime()) {
      return err(new ValidationError("HistoricalPeriod.to must not precede from"));
    }
    if (!Number.isInteger(props.days) || props.days <= 0) {
      return err(
        new ValidationError(
          `HistoricalPeriod.days must be a positive integer, received: ${String(props.days)}`,
        ),
      );
    }
    return ok(new HistoricalPeriod({ ...props }));
  }

  get from(): Date {
    return this.props.from;
  }

  get to(): Date {
    return this.props.to;
  }

  get days(): number {
    return this.props.days;
  }
}
