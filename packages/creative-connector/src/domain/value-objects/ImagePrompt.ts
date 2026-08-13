import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

const MAX_LENGTH = 5000;

/** A non-empty, bounded-length prompt string for Nano Banana Pro image generation. */
export class ImagePrompt {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<ImagePrompt, ValidationError> {
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return err(new ValidationError("ImagePrompt must be a non-empty string"));
    }
    if (raw.length > MAX_LENGTH) {
      return err(new ValidationError(`ImagePrompt must not exceed ${MAX_LENGTH} characters`));
    }
    return ok(new ImagePrompt(raw));
  }

  toString(): string {
    return this.value;
  }

  equals(other: ImagePrompt): boolean {
    return this.value === other.value;
  }
}
