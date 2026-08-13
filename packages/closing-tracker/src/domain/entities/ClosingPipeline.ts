import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { ConversionFunnel, ReportPeriod } from "../value-objects/index.js";

export interface ClosingPipelineProps {
  readonly period: ReportPeriod;
  readonly totalTestDrives: number;
  readonly totalSpk: number;
  readonly totalCancelled: number;
  /** Average calendar days between `Closing.testDriveAt` and `Closing.spkAt`, for closings (by `leadId`) that have both. `0` when no closing has both timestamps. */
  readonly avgDaysTestDriveToSpk: number;
  readonly funnel: ConversionFunnel;
}

/**
 * Test-drive → SPK funnel, built from `Closing.testDriveAt`/`.spkAt` (spec: "ClosingPipeline ←
 * test drive → spk → delivered"). Judgment call: `@aos/lead-store`'s `Closing`/`ClosingType` has
 * no "delivered" stage or timestamp field (only `TEST_DRIVE`/`SPK`/`CANCELLED`) — this entity
 * therefore tracks the two stages it can actually observe (test drive → SPK) plus cancellation
 * count, and does not fabricate a "delivered" figure lead-store has no data for. See package
 * report "ClosingPipeline delivered-stage gap".
 */
export class ClosingPipeline {
  private constructor(private readonly props: ClosingPipelineProps) {}

  static create(props: ClosingPipelineProps): Result<ClosingPipeline, ValidationError> {
    for (const [field, value] of [
      ["totalTestDrives", props.totalTestDrives],
      ["totalSpk", props.totalSpk],
      ["totalCancelled", props.totalCancelled],
    ] as const) {
      if (!Number.isInteger(value) || value < 0) {
        return err(
          new ValidationError(
            `ClosingPipeline.${field} must be a non-negative integer, received: ${String(value)}`,
          ),
        );
      }
    }
    if (!Number.isFinite(props.avgDaysTestDriveToSpk) || props.avgDaysTestDriveToSpk < 0) {
      return err(
        new ValidationError(
          `ClosingPipeline.avgDaysTestDriveToSpk must be a non-negative finite number, received: ${props.avgDaysTestDriveToSpk}`,
        ),
      );
    }
    return ok(new ClosingPipeline({ ...props }));
  }

  get period(): ReportPeriod {
    return this.props.period;
  }

  get totalTestDrives(): number {
    return this.props.totalTestDrives;
  }

  get totalSpk(): number {
    return this.props.totalSpk;
  }

  get totalCancelled(): number {
    return this.props.totalCancelled;
  }

  get avgDaysTestDriveToSpk(): number {
    return this.props.avgDaysTestDriveToSpk;
  }

  get funnel(): ConversionFunnel {
    return this.props.funnel;
  }
}
