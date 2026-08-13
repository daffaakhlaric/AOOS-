import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** A Kie AI uploaded-file identifier (`data.fileId`), e.g. `"file_abc1234"`. */
export class FileId {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<FileId, ValidationError> {
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return err(
        new ValidationError(`FileId must be a non-empty string, received: ${JSON.stringify(raw)}`),
      );
    }
    return ok(new FileId(raw));
  }

  toString(): string {
    return this.value;
  }

  equals(other: FileId): boolean {
    return this.value === other.value;
  }
}
