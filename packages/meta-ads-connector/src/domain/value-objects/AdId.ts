import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Internal AAOS-generated UUID identifying an Ad (distinct from Meta's raw `metaId`). */
export class AdId {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<AdId, ValidationError> {
    if (typeof raw !== "string" || !UUID_PATTERN.test(raw)) {
      return err(new ValidationError(`AdId must be a UUID, received: ${JSON.stringify(raw)}`));
    }
    return ok(new AdId(raw));
  }

  static generate(): AdId {
    return new AdId(crypto.randomUUID());
  }

  toString(): string {
    return this.value;
  }

  equals(other: AdId): boolean {
    return this.value === other.value;
  }
}
