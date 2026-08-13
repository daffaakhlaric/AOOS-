import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** The AAOS-internal identifier for a `CreativePackage` — a UUID this package generates itself. Mirrors `@aos/asset-library`'s `AssetId` / `@aos/meta-ads-agent`'s `CreativeBriefId` pattern. */
export class PackageId {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<PackageId, ValidationError> {
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return err(
        new ValidationError(
          `PackageId must be a non-empty string, received: ${JSON.stringify(raw)}`,
        ),
      );
    }
    return ok(new PackageId(raw));
  }

  static generate(): PackageId {
    return new PackageId(crypto.randomUUID());
  }

  toString(): string {
    return this.value;
  }

  equals(other: PackageId): boolean {
    return this.value === other.value;
  }
}
