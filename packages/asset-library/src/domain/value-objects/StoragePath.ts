import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/**
 * The Supabase Storage bucket-relative path for an `Asset`'s underlying file. Static generators
 * follow the spec's pinned "Business correctness" `storage_path` block exactly (design resolution
 * #2 — authoritative over the earlier illustrative bucket ASCII diagram):
 *   - unit photo   -> `units/{unitId}/photo-{timestamp}.{ext}`
 *   - brand asset  -> `brand/{filename}`
 *   - ai creative  -> `ai-creatives/{briefId}/{type}-{n}.{ext}`
 * `testimonial()` extends the same convention (`testimonials/{filename}`) for the `TESTIMONIAL`
 * `AssetType`, which the pinned block doesn't cover but the bucket diagram's `testimonials/`
 * top-level folder still names.
 */
export class StoragePath {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<StoragePath, ValidationError> {
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return err(
        new ValidationError(
          `StoragePath must be a non-empty string, received: ${JSON.stringify(raw)}`,
        ),
      );
    }
    return ok(new StoragePath(raw));
  }

  static unitPhoto(unitId: string, timestampMs: number, extension: string): StoragePath {
    return new StoragePath(`units/${unitId}/photo-${String(timestampMs)}.${extension}`);
  }

  static brandAsset(fileName: string): StoragePath {
    return new StoragePath(`brand/${fileName}`);
  }

  static testimonial(fileName: string): StoragePath {
    return new StoragePath(`testimonials/${fileName}`);
  }

  static aiCreative(
    briefId: string,
    type: "video" | "image",
    index: number,
    extension: string,
  ): StoragePath {
    return new StoragePath(`ai-creatives/${briefId}/${type}-${String(index)}.${extension}`);
  }

  toString(): string {
    return this.value;
  }

  equals(other: StoragePath): boolean {
    return this.value === other.value;
  }
}
