import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** The wall-clock instant a piece of data was scraped — always a valid, non-future-dated `Date`. */
export class ScrapeTimestamp {
  private constructor(private readonly _at: Date) {}

  static create(at: Date): Result<ScrapeTimestamp, ValidationError> {
    if (!(at instanceof Date) || Number.isNaN(at.getTime())) {
      return err(new ValidationError("ScrapeTimestamp must be a valid Date"));
    }
    return ok(new ScrapeTimestamp(new Date(at.getTime())));
  }

  static now(clock: () => Date = () => new Date()): ScrapeTimestamp {
    return new ScrapeTimestamp(clock());
  }

  get value(): Date {
    return new Date(this._at.getTime());
  }

  toISOString(): string {
    return this._at.toISOString();
  }
}
