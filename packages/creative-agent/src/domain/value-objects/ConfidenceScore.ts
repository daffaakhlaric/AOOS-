import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/**
 * A 0-100 score expressing how complete Kai's generated `CreativePackage` is. Design/judgment
 * call (the spec pins the field but not a formula, mirroring `@aos/meta-ads-agent`'s
 * `ConfidenceScore.fromCoverage` precedent of documenting the ONE formula in the ONE place it
 * lives):
 *
 *   confidence = round(imageCoverage * 60 + videoBonus * 40)
 *
 * where `imageCoverage` is `min(1, imageUrls.length / requestedImageCount)` (full weight once at
 * least the requested count of images succeeded) and `videoBonus` is 1 when a video was both
 * requested (format === VIDEO_AND_IMAGES) AND successfully produced, 0 when a video was requested
 * but gracefully fell back, and 1 when no video was ever requested (images-only was the correct,
 * intentional decision — Kai should not be penalized for a package it never tried to make).
 */
export class ConfidenceScore {
  private constructor(private readonly score: number) {}

  static create(score: number): Result<ConfidenceScore, ValidationError> {
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      return err(
        new ValidationError(`ConfidenceScore must be within 0-100, received: ${String(score)}`),
      );
    }
    return ok(new ConfidenceScore(Math.round(score)));
  }

  static compute(params: {
    readonly imageUrlCount: number;
    readonly requestedImageCount: number;
    readonly videoRequested: boolean;
    readonly videoDelivered: boolean;
  }): ConfidenceScore {
    const imageCoverage =
      params.requestedImageCount <= 0
        ? 0
        : Math.min(1, params.imageUrlCount / params.requestedImageCount);
    const videoBonus = !params.videoRequested || params.videoDelivered ? 1 : 0;
    const raw = imageCoverage * 60 + videoBonus * 40;
    /* v8 ignore next -- ConfidenceScore.create only rejects out-of-[0,100] input, and the weighted sum above (max 60 + 40 = 100, min 0) can never leave that range. */
    const result = ConfidenceScore.create(raw);
    /* v8 ignore next 3 -- unreachable: see above. */
    if (!result.ok) {
      return new ConfidenceScore(0);
    }
    return result.value;
  }

  toNumber(): number {
    return this.score;
  }

  isAbove(threshold: number): boolean {
    return this.score > threshold;
  }

  equals(other: ConfidenceScore): boolean {
    return this.score === other.score;
  }
}
