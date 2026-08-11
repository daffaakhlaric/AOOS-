import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Internal AAOS-generated UUID identifying a `CreativeBrief` sent to Kai (future `@aos/creative-agent`). */
export class CreativeBriefId {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<CreativeBriefId, ValidationError> {
    if (typeof raw !== "string" || !UUID_PATTERN.test(raw)) {
      return err(
        new ValidationError(`CreativeBriefId must be a UUID, received: ${JSON.stringify(raw)}`),
      );
    }
    return ok(new CreativeBriefId(raw));
  }

  static generate(): CreativeBriefId {
    return new CreativeBriefId(crypto.randomUUID());
  }

  toString(): string {
    return this.value;
  }

  equals(other: CreativeBriefId): boolean {
    return this.value === other.value;
  }
}
