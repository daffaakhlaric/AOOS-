import { BranchId } from "@aos/branch-manager";
import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { ClosingRate } from "../value-objects/index.js";

export interface SalesPerformanceProps {
  readonly salesHumanId: string;
  readonly salesHumanName: string;
  readonly branch: BranchId;
  readonly totalSpk: number;
  readonly totalTestDrives: number;
  readonly closingRate: ClosingRate;
  readonly totalCommissionIdr: number;
}

/**
 * **Spec gap filled (coordinator note #3)**: `ClosingReport.bySales: ReadonlyArray<SalesPerformance>`
 * is referenced but never given a field-level shape anywhere in the spec. Mirrors
 * `BranchPerformance`'s pattern per sales human, at minimum the coordinator note's suggested
 * fields (`salesHumanId`/name, `totalSpk`, `closingRate`, `totalCommissionIdr`, `branch`) plus
 * `totalTestDrives` for parity with `BranchPerformance`'s own shape.
 */
export class SalesPerformance {
  private constructor(private readonly props: SalesPerformanceProps) {}

  static create(props: SalesPerformanceProps): Result<SalesPerformance, ValidationError> {
    if (typeof props.salesHumanId !== "string" || props.salesHumanId.trim().length === 0) {
      return err(new ValidationError("SalesPerformance.salesHumanId must be a non-empty string"));
    }
    if (typeof props.salesHumanName !== "string" || props.salesHumanName.trim().length === 0) {
      return err(new ValidationError("SalesPerformance.salesHumanName must be a non-empty string"));
    }
    if (!Object.values(BranchId).includes(props.branch)) {
      return err(
        new ValidationError(
          `SalesPerformance.branch must be a valid BranchId, received: ${String(props.branch)}`,
        ),
      );
    }
    for (const [field, value] of [
      ["totalSpk", props.totalSpk],
      ["totalTestDrives", props.totalTestDrives],
      ["totalCommissionIdr", props.totalCommissionIdr],
    ] as const) {
      if (!Number.isFinite(value) || value < 0) {
        return err(
          new ValidationError(
            `SalesPerformance.${field} must be a non-negative finite number, received: ${String(value)}`,
          ),
        );
      }
    }
    return ok(new SalesPerformance({ ...props }));
  }

  get salesHumanId(): string {
    return this.props.salesHumanId;
  }

  get salesHumanName(): string {
    return this.props.salesHumanName;
  }

  get branch(): BranchId {
    return this.props.branch;
  }

  get totalSpk(): number {
    return this.props.totalSpk;
  }

  get totalTestDrives(): number {
    return this.props.totalTestDrives;
  }

  get closingRate(): ClosingRate {
    return this.props.closingRate;
  }

  get totalCommissionIdr(): number {
    return this.props.totalCommissionIdr;
  }
}
