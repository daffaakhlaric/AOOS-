import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** The AAOS-internal identifier for one `GenerationJob` run — a UUID this package generates itself. Mirrors `PackageId`'s pattern in the same package. */
export class JobId {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<JobId, ValidationError> {
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return err(
        new ValidationError(`JobId must be a non-empty string, received: ${JSON.stringify(raw)}`),
      );
    }
    return ok(new JobId(raw));
  }

  static generate(): JobId {
    return new JobId(crypto.randomUUID());
  }

  toString(): string {
    return this.value;
  }

  equals(other: JobId): boolean {
    return this.value === other.value;
  }
}
