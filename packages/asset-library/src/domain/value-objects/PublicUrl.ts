import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** The CDN-facing public URL Supabase Storage returns for an uploaded object (spec: `PublicUrl.ts ← CDN URL`). */
export class PublicUrl {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<PublicUrl, ValidationError> {
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return err(
        new ValidationError(
          `PublicUrl must be a non-empty string, received: ${JSON.stringify(raw)}`,
        ),
      );
    }
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return err(new ValidationError(`PublicUrl must be a valid absolute URL, received: ${raw}`));
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return err(new ValidationError(`PublicUrl must use http(s), received: ${raw}`));
    }
    return ok(new PublicUrl(raw));
  }

  toString(): string {
    return this.value;
  }

  equals(other: PublicUrl): boolean {
    return this.value === other.value;
  }
}
