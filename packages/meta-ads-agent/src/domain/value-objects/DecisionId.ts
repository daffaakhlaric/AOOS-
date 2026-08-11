import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Internal AAOS-generated UUID identifying a single `CampaignDecision`. */
export class DecisionId {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<DecisionId, ValidationError> {
    if (typeof raw !== "string" || !UUID_PATTERN.test(raw)) {
      return err(
        new ValidationError(`DecisionId must be a UUID, received: ${JSON.stringify(raw)}`),
      );
    }
    return ok(new DecisionId(raw));
  }

  static generate(): DecisionId {
    return new DecisionId(crypto.randomUUID());
  }

  toString(): string {
    return this.value;
  }

  equals(other: DecisionId): boolean {
    return this.value === other.value;
  }
}
