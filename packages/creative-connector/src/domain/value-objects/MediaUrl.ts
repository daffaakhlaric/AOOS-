import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/**
 * The final generated-media CDN URL (`videoUrl`/`imageUrl` from a completed poll response).
 * Distinct type from `FileUrl` (the *source*-photo upload URL) even though both are Kie AI CDN
 * URLs — keeps "what you uploaded" and "what Kie AI generated" from being accidentally
 * interchanged at call sites.
 */
export class MediaUrl {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<MediaUrl, ValidationError> {
    if (typeof raw !== "string" || !/^https?:\/\/.+/.test(raw)) {
      return err(
        new ValidationError(
          `MediaUrl must be an absolute http(s) URL, received: ${JSON.stringify(raw)}`,
        ),
      );
    }
    return ok(new MediaUrl(raw));
  }

  toString(): string {
    return this.value;
  }

  equals(other: MediaUrl): boolean {
    return this.value === other.value;
  }
}
