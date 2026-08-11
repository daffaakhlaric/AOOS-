import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/**
 * A WhatsApp Cloud API status-update timestamp — Meta sends these as Unix epoch seconds
 * (a string, e.g. `"1690000000"`), not milliseconds; this value object owns that conversion so no
 * caller has to remember the seconds-vs-milliseconds distinction.
 */
export class DeliveryTimestamp {
  private constructor(private readonly date: Date) {}

  static fromUnixSeconds(raw: string): Result<DeliveryTimestamp, ValidationError> {
    if (typeof raw !== "string" || raw.trim().length === 0 || !/^\d+$/.test(raw)) {
      return err(
        new ValidationError(
          `DeliveryTimestamp must be a Unix-seconds numeric string, received: ${JSON.stringify(raw)}`,
        ),
      );
    }
    const seconds = Number(raw);
    if (!Number.isFinite(seconds)) {
      return err(new ValidationError(`DeliveryTimestamp overflowed a safe number: ${raw}`));
    }
    return ok(new DeliveryTimestamp(new Date(seconds * 1000)));
  }

  static fromDate(date: Date): DeliveryTimestamp {
    return new DeliveryTimestamp(date);
  }

  toDate(): Date {
    return this.date;
  }

  equals(other: DeliveryTimestamp): boolean {
    return this.date.getTime() === other.date.getTime();
  }
}
