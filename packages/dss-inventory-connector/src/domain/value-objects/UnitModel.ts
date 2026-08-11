import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** A vehicle model name, e.g. "Xpander Cross", "Avanza Veloz" — brand and trim excluded (see `UnitBrand`, `InventoryUnit.variant`). */
export class UnitModel {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<UnitModel, ValidationError> {
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return err(
        new ValidationError(
          `UnitModel must be a non-empty string, received: ${JSON.stringify(raw)}`,
        ),
      );
    }
    return ok(new UnitModel(raw.trim()));
  }

  toString(): string {
    return this.value;
  }

  equals(other: UnitModel): boolean {
    return this.value === other.value;
  }
}
