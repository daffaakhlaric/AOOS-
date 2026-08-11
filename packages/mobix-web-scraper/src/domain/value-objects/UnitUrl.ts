import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** A unit-detail page URL on mobixbydss.id — must be an absolute http(s) URL. */
export class UnitUrl {
  private constructor(private readonly _href: string) {}

  static create(href: string): Result<UnitUrl, ValidationError> {
    if (typeof href !== "string" || href.trim().length === 0) {
      return err(new ValidationError("UnitUrl must be a non-empty string"));
    }
    let parsed: URL;
    try {
      parsed = new URL(href);
    } catch {
      return err(new ValidationError(`UnitUrl must be an absolute URL, received: ${href}`));
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return err(new ValidationError(`UnitUrl must use http(s), received: ${href}`));
    }
    return ok(new UnitUrl(href));
  }

  get href(): string {
    return this._href;
  }

  /** The unit slug — the last non-empty path segment, used as a stable per-unit identity key. */
  get slug(): string {
    const segments = new URL(this._href).pathname.split("/").filter((s) => s.length > 0);
    return segments.length > 0 ? segments[segments.length - 1]! : "";
  }

  equals(other: UnitUrl): boolean {
    return this._href === other._href;
  }
}
