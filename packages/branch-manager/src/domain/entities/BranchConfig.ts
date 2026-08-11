import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { AssignmentMode } from "../value-objects/AssignmentMode.js";
import type { BranchId } from "../value-objects/BranchId.js";
import type { MaxLeadsPerDay } from "../value-objects/MaxLeadsPerDay.js";
import type { WabaPhoneNumberId } from "../value-objects/WabaPhoneNumberId.js";

export interface BranchConfigProps {
  readonly id: BranchId;
  readonly name: string;
  readonly displayName: string;
  readonly wabaPhoneNumberId: WabaPhoneNumberId;
  readonly wabaPhoneNumber: string;
  readonly assignmentMode: AssignmentMode;
  readonly maxLeadsPerSalesPerDay: MaxLeadsPerDay;
  readonly managerWaNumber?: string;
  readonly active: boolean;
}

/**
 * A DSS Motor branch's full operating configuration — WABA routing identity, default assignment
 * strategy, and per-sales daily quota default. Immutable: `BranchRegistry.update` produces a new
 * instance via `create`, never an in-place edit.
 */
export class BranchConfig {
  private constructor(private readonly props: BranchConfigProps) {}

  static create(props: BranchConfigProps): Result<BranchConfig, ValidationError> {
    if (typeof props.name !== "string" || props.name.trim().length === 0) {
      return err(new ValidationError("BranchConfig.name must be a non-empty string"));
    }
    if (typeof props.displayName !== "string" || props.displayName.trim().length === 0) {
      return err(new ValidationError("BranchConfig.displayName must be a non-empty string"));
    }
    if (typeof props.wabaPhoneNumber !== "string" || props.wabaPhoneNumber.trim().length === 0) {
      return err(new ValidationError("BranchConfig.wabaPhoneNumber must be a non-empty string"));
    }
    if (props.managerWaNumber !== undefined && props.managerWaNumber.trim().length === 0) {
      return err(
        new ValidationError("BranchConfig.managerWaNumber must not be an empty string when set"),
      );
    }
    return ok(new BranchConfig({ ...props }));
  }

  get id(): BranchId {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get displayName(): string {
    return this.props.displayName;
  }

  get wabaPhoneNumberId(): WabaPhoneNumberId {
    return this.props.wabaPhoneNumberId;
  }

  get wabaPhoneNumber(): string {
    return this.props.wabaPhoneNumber;
  }

  get assignmentMode(): AssignmentMode {
    return this.props.assignmentMode;
  }

  get maxLeadsPerSalesPerDay(): MaxLeadsPerDay {
    return this.props.maxLeadsPerSalesPerDay;
  }

  get managerWaNumber(): string | undefined {
    return this.props.managerWaNumber;
  }

  get active(): boolean {
    return this.props.active;
  }

  /** Immutable update — used by `BranchRegistry.update`, never mutates in place. */
  withAssignmentMode(mode: AssignmentMode): BranchConfig {
    return new BranchConfig({ ...this.props, assignmentMode: mode });
  }
}
