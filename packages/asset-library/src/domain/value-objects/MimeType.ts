import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** File Validation — allowed image MIME types (spec's "File Validation"). */
export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
/** File Validation — allowed video MIME types (spec's "File Validation"). */
export const ALLOWED_VIDEO_MIME_TYPES = ["video/mp4"] as const;

const EXTENSION_BY_MIME: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
};

/**
 * A validated file MIME type — the sole gate for the spec's file-type allow-list
 * (`image/jpeg`/`image/png`/`image/webp`/`video/mp4`). Validation applies uniformly across every
 * `AssetType` (design resolution #4): the spec gives one global allow-list with no per-`AssetType`
 * variation, so this value object does not know about `AssetType` at all.
 */
export class MimeType {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<MimeType, ValidationError> {
    if (
      !(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(raw) &&
      !(ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(raw)
    ) {
      return err(
        new ValidationError(
          `MimeType must be one of ${[...ALLOWED_IMAGE_MIME_TYPES, ...ALLOWED_VIDEO_MIME_TYPES].join(", ")}, received: ${JSON.stringify(raw)}`,
        ),
      );
    }
    return ok(new MimeType(raw));
  }

  isImage(): boolean {
    return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(this.value);
  }

  isVideo(): boolean {
    return (ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(this.value);
  }

  /** The conventional file extension for this MIME type (e.g. `image/jpeg` -> `jpg`), used by `StoragePath` generation. */
  extension(): string {
    /* v8 ignore next -- every constructed MimeType passed `create`'s allow-list check, so every
       value has a mapped extension; the fallback exists only to keep the return type `string`. */
    return EXTENSION_BY_MIME[this.value] ?? "bin";
  }

  toString(): string {
    return this.value;
  }

  equals(other: MimeType): boolean {
    return this.value === other.value;
  }
}
