import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/**
 * A file's size in bytes — purely structural validation (non-negative integer). The spec's
 * business-rule size LIMITS (10MB image / 100MB video, per design resolution #4 applied uniformly
 * regardless of `AssetType`) are enforced by `StorageService` against `AssetLibraryConfig`, not by
 * this value object, so the limits stay config-driven rather than hardcoded here.
 */
export class FileSize {
  private constructor(private readonly value: number) {}

  static create(bytes: number): Result<FileSize, ValidationError> {
    if (!Number.isInteger(bytes) || bytes < 0) {
      return err(
        new ValidationError(`FileSize must be a non-negative integer, received: ${String(bytes)}`),
      );
    }
    return ok(new FileSize(bytes));
  }

  get bytes(): number {
    return this.value;
  }

  exceeds(limitBytes: number): boolean {
    return this.value > limitBytes;
  }

  toString(): string {
    return String(this.value);
  }

  equals(other: FileSize): boolean {
    return this.value === other.value;
  }
}
