import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** The number of hot leads an Objective targets — a positive integer (spec: "targetHotLeads > 0"). */
export class TargetLeads {
  private constructor(private readonly count: number) {}

  static create(count: number): Result<TargetLeads, ValidationError> {
    if (typeof count !== "number" || !Number.isFinite(count)) {
      return err(
        new ValidationError(`TargetLeads must be a finite number, received: ${String(count)}`),
      );
    }
    if (!Number.isInteger(count)) {
      return err(new ValidationError(`TargetLeads must be an integer, received: ${count}`));
    }
    if (count <= 0) {
      return err(new ValidationError(`TargetLeads must be greater than 0, received: ${count}`));
    }
    return ok(new TargetLeads(count));
  }

  toNumber(): number {
    return this.count;
  }

  equals(other: TargetLeads): boolean {
    return this.count === other.count;
  }
}
