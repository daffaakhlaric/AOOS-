import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { CreativeAgentError } from "./CreativeAgentError.js";

/**
 * COORDINATOR NOTE #7 applied: `@aos/creative-connector`'s `GenerateImage` already supports pure
 * text-to-image generation (its `sourceImageUrl` input is optional), so "zero photos returned
 * from `@aos/asset-library`" is a normal, handled case (`FormatDecider` routes it straight to
 * `IMAGES_ONLY` and Kai generates from text) — NOT an error. This error is reserved for a genuine
 * `@aos/asset-library` `GetAssetsByUnit` query FAILURE (the repository call itself erroring),
 * never simply "the unit has no photos on file yet".
 */
export class NoSourcePhotosError extends CreativeAgentError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(ErrorCode.UNAVAILABLE, message, options);
  }
}
