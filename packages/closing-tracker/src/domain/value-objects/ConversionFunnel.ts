import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import { ClosingRate } from "./ClosingRate.js";

/**
 * **Spec gap filled (coordinator note #3)**: `ConversionFunnel` is listed in the folder structure
 * ("hot → test drive → spk rates") but never given a field-level shape. This package models it as
 * the three raw stage counts plus the two consecutive-stage rates (`hotToTestDriveRate`,
 * `testDriveToSpkRate`) — deliberately NOT the direct `hotToSpkRate` (that's `ClosingRate`,
 * already a first-class `ClosingReport.closingRate` field), keeping this value object focused on
 * the *funnel* shape (each stage vs. the one right before it) rather than duplicating the overall
 * conversion rate under a second name.
 */
export interface ConversionFunnelProps {
  readonly hotLeadCount: number;
  readonly testDriveCount: number;
  readonly spkCount: number;
}

export class ConversionFunnel {
  private constructor(
    private readonly props: ConversionFunnelProps,
    private readonly hotToTestDrive: ClosingRate,
    private readonly testDriveToSpk: ClosingRate,
  ) {}

  static create(props: ConversionFunnelProps): Result<ConversionFunnel, ValidationError> {
    for (const [field, value] of Object.entries(props)) {
      if (!Number.isInteger(value) || value < 0) {
        return err(
          new ValidationError(
            `ConversionFunnel.${field} must be a non-negative integer, received: ${String(value)}`,
          ),
        );
      }
    }
    return ok(
      new ConversionFunnel(
        { ...props },
        ClosingRate.fromCounts(props.testDriveCount, props.hotLeadCount),
        ClosingRate.fromCounts(props.spkCount, props.testDriveCount),
      ),
    );
  }

  get hotLeadCount(): number {
    return this.props.hotLeadCount;
  }

  get testDriveCount(): number {
    return this.props.testDriveCount;
  }

  get spkCount(): number {
    return this.props.spkCount;
  }

  /** `testDriveCount / hotLeadCount`, divide-by-zero-safe (0.0 when `hotLeadCount === 0`). */
  get hotToTestDriveRate(): ClosingRate {
    return this.hotToTestDrive;
  }

  /** `spkCount / testDriveCount`, divide-by-zero-safe (0.0 when `testDriveCount === 0`). */
  get testDriveToSpkRate(): ClosingRate {
    return this.testDriveToSpk;
  }
}
