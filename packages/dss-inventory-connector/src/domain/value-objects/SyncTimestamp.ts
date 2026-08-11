import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** The moment an `InventoryUnit` was last confirmed present by a sync run. */
export class SyncTimestamp {
  private constructor(private readonly value: Date) {}

  static create(raw: Date): Result<SyncTimestamp, ValidationError> {
    if (!(raw instanceof Date) || Number.isNaN(raw.getTime())) {
      return err(
        new ValidationError(`SyncTimestamp must be a valid Date, received: ${String(raw)}`),
      );
    }
    return ok(new SyncTimestamp(raw));
  }

  toDate(): Date {
    return this.value;
  }

  isBefore(other: SyncTimestamp): boolean {
    return this.value.getTime() < other.value.getTime();
  }

  equals(other: SyncTimestamp): boolean {
    return this.value.getTime() === other.value.getTime();
  }
}
