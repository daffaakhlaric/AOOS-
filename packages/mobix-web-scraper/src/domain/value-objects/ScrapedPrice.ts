import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/**
 * A unit's listed price in whole IDR — always a non-negative integer. Constructed only via
 * `create()` (never a bare `new`), matching this monorepo's Value Object discipline.
 */
export class ScrapedPrice {
  private constructor(private readonly _idr: number) {}

  static create(idr: number): Result<ScrapedPrice, ValidationError> {
    if (!Number.isFinite(idr) || idr < 0) {
      return err(
        new ValidationError(
          `ScrapedPrice must be a non-negative finite number, received: ${String(idr)}`,
        ),
      );
    }
    return ok(new ScrapedPrice(Math.round(idr)));
  }

  get idr(): number {
    return this._idr;
  }

  equals(other: ScrapedPrice): boolean {
    return this._idr === other._idr;
  }

  toString(): string {
    return `Rp ${this._idr.toLocaleString("id-ID")}`;
  }
}
