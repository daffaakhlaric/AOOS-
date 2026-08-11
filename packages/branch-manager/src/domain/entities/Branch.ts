import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { BranchId } from "../value-objects/BranchId.js";

export interface BranchProps {
  readonly id: BranchId;
  readonly name: string;
  readonly displayName: string;
  readonly active: boolean;
}

/**
 * Judgment call: the spec's folder tree lists both `entities/Branch.ts` ("branch entity — not
 * just enum") and `entities/BranchConfig.ts` ("full branch configuration"), but the spec's own
 * "Domain Models" section only describes one shape — `BranchConfig`'s flat 9-field literal shown
 * verbatim — and the Public API export list only exports `BranchConfig`, never `Branch`. Since the
 * folder tree is authoritative for what must exist (per this package's other resolved
 * ambiguities), `Branch` is built as a lightweight, standalone identity entity — the pure "which
 * branch" identity (id/name/displayName/active) distinct from `BranchConfig`'s full WABA +
 * assignment configuration. `BranchRegistry`/`BranchConfig` do not compose through this entity
 * (the DSS_MOTOR_BRANCHES seed shape in the spec is the flat `BranchConfig` shape directly, not
 * nested under a `branch` field), so `Branch` is currently a self-contained entity satisfying the
 * folder tree's explicit listing, reserved for future use (e.g. multiple `BranchConfig` revisions
 * sharing one `Branch` identity) rather than wired into today's assignment flows.
 */
export class Branch {
  private constructor(private readonly props: BranchProps) {}

  static create(props: BranchProps): Result<Branch, ValidationError> {
    if (typeof props.name !== "string" || props.name.trim().length === 0) {
      return err(new ValidationError("Branch.name must be a non-empty string"));
    }
    if (typeof props.displayName !== "string" || props.displayName.trim().length === 0) {
      return err(new ValidationError("Branch.displayName must be a non-empty string"));
    }
    return ok(new Branch({ ...props }));
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

  get active(): boolean {
    return this.props.active;
  }

  /** Immutable update — returns a new instance, never mutates in place. */
  withActive(active: boolean): Branch {
    return new Branch({ ...this.props, active });
  }
}
