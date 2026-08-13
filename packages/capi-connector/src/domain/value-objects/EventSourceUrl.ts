import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** Meta CAPI's `event_source_url` field — AAOS always sends `https://mobixbydss.id` (spec pin), but this validates any well-formed `https://` URL so config stays swappable per tenant. */
export class EventSourceUrl {
  private constructor(private readonly url: string) {}

  static create(raw: string): Result<EventSourceUrl, ValidationError> {
    if (typeof raw !== "string" || !/^https:\/\/.+/.test(raw)) {
      return err(
        new ValidationError(
          `EventSourceUrl must be an https:// URL, received: ${JSON.stringify(raw)}`,
        ),
      );
    }
    return ok(new EventSourceUrl(raw));
  }

  toString(): string {
    return this.url;
  }
}
