import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

const MAX_LENGTH = 5000;

/** A non-empty, bounded-length prompt string for Veo video generation. */
export class VideoPrompt {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<VideoPrompt, ValidationError> {
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return err(new ValidationError("VideoPrompt must be a non-empty string"));
    }
    if (raw.length > MAX_LENGTH) {
      return err(new ValidationError(`VideoPrompt must not exceed ${MAX_LENGTH} characters`));
    }
    return ok(new VideoPrompt(raw));
  }

  toString(): string {
    return this.value;
  }

  equals(other: VideoPrompt): boolean {
    return this.value === other.value;
  }
}
