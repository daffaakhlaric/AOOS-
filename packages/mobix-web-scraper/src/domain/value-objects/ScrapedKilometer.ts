import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** A unit's odometer reading in whole kilometers — always a non-negative integer. */
export class ScrapedKilometer {
  private constructor(private readonly _km: number) {}

  static create(km: number): Result<ScrapedKilometer, ValidationError> {
    if (!Number.isFinite(km) || km < 0) {
      return err(
        new ValidationError(
          `ScrapedKilometer must be a non-negative finite number, received: ${String(km)}`,
        ),
      );
    }
    return ok(new ScrapedKilometer(Math.round(km)));
  }

  get km(): number {
    return this._km;
  }

  equals(other: ScrapedKilometer): boolean {
    return this._km === other._km;
  }

  toString(): string {
    return `${this._km.toLocaleString("id-ID")} km`;
  }
}
