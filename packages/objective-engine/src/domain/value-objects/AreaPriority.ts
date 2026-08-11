import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import { Branch } from "@aos/meta-ads-connector";

/** A prioritized dealer `Branch` (imported read-only from `@aos/meta-ads-connector`), per the spec's `AreaPriority ← Branch from meta-ads-connector`. */
export class AreaPriority {
  private constructor(private readonly branch: Branch) {}

  static create(raw: string): Result<AreaPriority, ValidationError> {
    if (typeof raw !== "string" || !Object.values(Branch).includes(raw as Branch)) {
      return err(
        new ValidationError(
          `AreaPriority must be a valid Branch, received: ${JSON.stringify(raw)}`,
        ),
      );
    }
    return ok(new AreaPriority(raw as Branch));
  }

  static fromBranch(branch: Branch): AreaPriority {
    return new AreaPriority(branch);
  }

  toBranch(): Branch {
    return this.branch;
  }

  equals(other: AreaPriority): boolean {
    return this.branch === other.branch;
  }
}
