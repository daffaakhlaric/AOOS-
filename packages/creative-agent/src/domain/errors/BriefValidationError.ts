import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { CreativeAgentError } from "./CreativeAgentError.js";

/** The `CreativeBrief` handed to `ProcessCreativeBrief` failed Kai's own defensive re-validation (e.g. an empty `formats` array) — distinct from `@aos/meta-ads-agent`'s own `CreativeBrief.create` validation, which already runs before Kai ever sees the brief. */
export class BriefValidationError extends CreativeAgentError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(ErrorCode.VALIDATION_ERROR, message, options);
  }
}
