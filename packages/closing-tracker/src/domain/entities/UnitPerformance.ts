import { BranchId } from "@aos/branch-manager";
import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { ClosingRate } from "../value-objects/index.js";

export interface UnitPerformanceProps {
  readonly unitModel: string;
  readonly totalSpk: number;
  readonly avgSpkValue: number;
  readonly avgCommission: number;
  readonly closingRate: ClosingRate;
  readonly topBranch: BranchId;
}

/** Per-unit-model closing stats (spec: "UnitPerformance (Value Object)", placed under `domain/entities/` per the folder structure). */
export class UnitPerformance {
  private constructor(private readonly props: UnitPerformanceProps) {}

  static create(props: UnitPerformanceProps): Result<UnitPerformance, ValidationError> {
    if (typeof props.unitModel !== "string" || props.unitModel.trim().length === 0) {
      return err(new ValidationError("UnitPerformance.unitModel must be a non-empty string"));
    }
    for (const [field, value] of [
      ["totalSpk", props.totalSpk],
      ["avgSpkValue", props.avgSpkValue],
      ["avgCommission", props.avgCommission],
    ] as const) {
      if (!Number.isFinite(value) || value < 0) {
        return err(
          new ValidationError(
            `UnitPerformance.${field} must be a non-negative finite number, received: ${String(value)}`,
          ),
        );
      }
    }
    if (!Object.values(BranchId).includes(props.topBranch)) {
      return err(
        new ValidationError(
          `UnitPerformance.topBranch must be a valid BranchId, received: ${String(props.topBranch)}`,
        ),
      );
    }
    return ok(new UnitPerformance({ ...props }));
  }

  get unitModel(): string {
    return this.props.unitModel;
  }

  get totalSpk(): number {
    return this.props.totalSpk;
  }

  get avgSpkValue(): number {
    return this.props.avgSpkValue;
  }

  get avgCommission(): number {
    return this.props.avgCommission;
  }

  get closingRate(): ClosingRate {
    return this.props.closingRate;
  }

  get topBranch(): BranchId {
    return this.props.topBranch;
  }
}
