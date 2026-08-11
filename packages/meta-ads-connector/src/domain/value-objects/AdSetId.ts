import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Internal AAOS-generated UUID identifying an AdSet (distinct from Meta's raw `metaId`). */
export class AdSetId {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<AdSetId, ValidationError> {
    if (typeof raw !== "string" || !UUID_PATTERN.test(raw)) {
      return err(new ValidationError(`AdSetId must be a UUID, received: ${JSON.stringify(raw)}`));
    }
    return ok(new AdSetId(raw));
  }

  static generate(): AdSetId {
    return new AdSetId(crypto.randomUUID());
  }

  toString(): string {
    return this.value;
  }

  equals(other: AdSetId): boolean {
    return this.value === other.value;
  }
}
