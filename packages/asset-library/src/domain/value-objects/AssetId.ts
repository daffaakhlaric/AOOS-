import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** The AAOS-internal identifier for an `Asset` record — a UUID this package generates itself (or accepts back from a Supabase row's `id` column). Mirrors `@aos/lead-store`'s `LeadId` pattern. */
export class AssetId {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<AssetId, ValidationError> {
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return err(
        new ValidationError(`AssetId must be a non-empty string, received: ${JSON.stringify(raw)}`),
      );
    }
    return ok(new AssetId(raw));
  }

  static generate(): AssetId {
    return new AssetId(crypto.randomUUID());
  }

  toString(): string {
    return this.value;
  }

  equals(other: AssetId): boolean {
    return this.value === other.value;
  }
}
