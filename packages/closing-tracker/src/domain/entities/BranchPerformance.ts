import { BranchId } from "@aos/branch-manager";
import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { ClosingRate, RphSpk } from "../value-objects/index.js";

export interface BranchPerformanceProps {
  readonly branch: BranchId;
  readonly totalSpk: number;
  readonly totalTestDrives: number;
  readonly closingRate: ClosingRate;
  readonly totalCommissionIdr: number;
  readonly avgRphSpk: RphSpk;
  readonly topSalesName: string;
}

/** Per-branch closing stats (spec: "BranchPerformance (Value Object)", placed under `domain/entities/` per the folder structure). */
export class BranchPerformance {
  private constructor(private readonly props: BranchPerformanceProps) {}

  static create(props: BranchPerformanceProps): Result<BranchPerformance, ValidationError> {
    if (!Object.values(BranchId).includes(props.branch)) {
      return err(
        new ValidationError(
          `BranchPerformance.branch must be a valid BranchId, received: ${String(props.branch)}`,
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
            `BranchPerformance.${field} must be a non-negative finite number, received: ${String(value)}`,
          ),
        );
      }
    }
    if (typeof props.topSalesName !== "string" || props.topSalesName.trim().length === 0) {
      return err(new ValidationError("BranchPerformance.topSalesName must be a non-empty string"));
    }
    return ok(new BranchPerformance({ ...props }));
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

  get avgRphSpk(): RphSpk {
    return this.props.avgRphSpk;
  }

  get topSalesName(): string {
    return this.props.topSalesName;
  }
}
