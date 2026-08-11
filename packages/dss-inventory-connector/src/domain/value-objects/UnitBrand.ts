import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** A vehicle brand/make, e.g. "Mitsubishi", "Toyota", "Honda". */
export class UnitBrand {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<UnitBrand, ValidationError> {
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return err(
        new ValidationError(
          `UnitBrand must be a non-empty string, received: ${JSON.stringify(raw)}`,
        ),
      );
    }
    return ok(new UnitBrand(raw.trim()));
  }

  toString(): string {
    return this.value;
  }

  equals(other: UnitBrand): boolean {
    return this.value === other.value;
  }
}
