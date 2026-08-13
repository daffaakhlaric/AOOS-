import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** Meta CAPI's `action_source` field — always `"website"` for AAOS's CTWA-sourced conversions (spec pin). */
export class ActionSource {
  private static readonly WEBSITE_VALUE = "website" as const;
  private constructor(private readonly value: "website") {}

  static website(): ActionSource {
    return new ActionSource(ActionSource.WEBSITE_VALUE);
  }

  static create(raw: string): Result<ActionSource, ValidationError> {
    if (raw !== ActionSource.WEBSITE_VALUE) {
      return err(
        new ValidationError(`ActionSource must be "website", received: ${JSON.stringify(raw)}`),
      );
    }
    return ok(ActionSource.website());
  }

  toString(): string {
    return this.value;
  }
}
