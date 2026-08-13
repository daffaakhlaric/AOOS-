import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** The Meta Pixel id (`{pixel-id}` in `POST /{api-version}/{pixel-id}/events`). Non-empty string. */
export class PixelId {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<PixelId, ValidationError> {
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return err(
        new ValidationError(`PixelId must be a non-empty string, received: ${JSON.stringify(raw)}`),
      );
    }
    return ok(new PixelId(raw));
  }

  toString(): string {
    return this.value;
  }

  equals(other: PixelId): boolean {
    return this.value === other.value;
  }
}
