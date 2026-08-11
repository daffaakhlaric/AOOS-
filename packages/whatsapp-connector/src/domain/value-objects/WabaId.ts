import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** Meta's WABA (WhatsApp Business Account) id — an opaque non-empty digit string. */
export class WabaId {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<WabaId, ValidationError> {
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return err(
        new ValidationError(`WabaId must be a non-empty string, received: ${JSON.stringify(raw)}`),
      );
    }
    return ok(new WabaId(raw));
  }

  toString(): string {
    return this.value;
  }

  equals(other: WabaId): boolean {
    return this.value === other.value;
  }
}
