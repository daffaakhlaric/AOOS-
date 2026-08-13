import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/**
 * The CDN URL returned by Kie AI's file-stream-upload endpoint (`data.fileUrl`), e.g.
 * `"https://cdn.kie.ai/images/aaos-dss/xpander-001.jpg"`. Per Part 1 of the spec, this URL
 * expires 24h after upload — this Value Object only validates shape, not liveness.
 */
export class FileUrl {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<FileUrl, ValidationError> {
    if (typeof raw !== "string" || !/^https?:\/\/.+/.test(raw)) {
      return err(
        new ValidationError(
          `FileUrl must be an absolute http(s) URL, received: ${JSON.stringify(raw)}`,
        ),
      );
    }
    return ok(new FileUrl(raw));
  }

  toString(): string {
    return this.value;
  }

  equals(other: FileUrl): boolean {
    return this.value === other.value;
  }
}
