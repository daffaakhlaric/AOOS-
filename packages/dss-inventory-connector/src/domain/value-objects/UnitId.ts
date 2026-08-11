import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/**
 * The AAOS-internal identifier for an `InventoryUnit` — a UUID this package generates itself
 * (never taken from an external source; that is `DmsUnitId`'s job). Mirrors
 * `@aos/whatsapp-connector`'s `MessageId` value-object pattern (`create` for validated wrapping,
 * `generate` for fresh ids), used as the `Map` key in `InMemoryInventoryStore` via `.toString()`.
 */
export class UnitId {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<UnitId, ValidationError> {
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return err(
        new ValidationError(`UnitId must be a non-empty string, received: ${JSON.stringify(raw)}`),
      );
    }
    return ok(new UnitId(raw));
  }

  static generate(): UnitId {
    return new UnitId(crypto.randomUUID());
  }

  toString(): string {
    return this.value;
  }

  equals(other: UnitId): boolean {
    return this.value === other.value;
  }
}
