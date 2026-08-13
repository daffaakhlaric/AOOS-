import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { EmqScore } from "../value-objects/EmqScore.js";

export interface EmqReportProps {
  readonly pixelId: string;
  readonly score: EmqScore;
  readonly eventsReceived: number;
  readonly capturedAt: Date;
}

/** Meta's Event Match Quality report for one pixel, as of `capturedAt`. */
export class EmqReport {
  private constructor(private readonly props: EmqReportProps) {}

  static create(props: EmqReportProps): Result<EmqReport, ValidationError> {
    if (!Number.isFinite(props.eventsReceived) || props.eventsReceived < 0) {
      return err(
        new ValidationError(
          `EmqReport.eventsReceived must be a non-negative number, received: ${props.eventsReceived}`,
        ),
      );
    }
    return ok(new EmqReport({ ...props }));
  }

  get pixelId(): string {
    return this.props.pixelId;
  }

  get score(): EmqScore {
    return this.props.score;
  }

  get eventsReceived(): number {
    return this.props.eventsReceived;
  }

  get capturedAt(): Date {
    return this.props.capturedAt;
  }
}
