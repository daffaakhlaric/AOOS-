import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Internal AAOS-generated UUID identifying a single `ExecutionPlan` produced by one optimization cycle. */
export class ExecutionPlanId {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<ExecutionPlanId, ValidationError> {
    if (typeof raw !== "string" || !UUID_PATTERN.test(raw)) {
      return err(
        new ValidationError(`ExecutionPlanId must be a UUID, received: ${JSON.stringify(raw)}`),
      );
    }
    return ok(new ExecutionPlanId(raw));
  }

  static generate(): ExecutionPlanId {
    return new ExecutionPlanId(crypto.randomUUID());
  }

  toString(): string {
    return this.value;
  }

  equals(other: ExecutionPlanId): boolean {
    return this.value === other.value;
  }
}
