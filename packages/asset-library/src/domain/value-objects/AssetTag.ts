import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/**
 * A single free-text tag attached to an `Asset` (spec: "branch, model, year, angle"). Kept as a
 * thin validated string wrapper rather than a `{key, value}` pair — the spec's `UploadAsset`
 * input takes `tags?: string[]` and every sibling package's manual tags are plain strings; derived
 * tags (branch/model/year) are formatted as `key:value` strings by `DefaultAssetTagger` so they
 * remain plain strings end-to-end.
 */
export class AssetTag {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<AssetTag, ValidationError> {
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return err(
        new ValidationError(
          `AssetTag must be a non-empty string, received: ${JSON.stringify(raw)}`,
        ),
      );
    }
    return ok(new AssetTag(raw.trim()));
  }

  toString(): string {
    return this.value;
  }

  equals(other: AssetTag): boolean {
    return this.value === other.value;
  }
}
