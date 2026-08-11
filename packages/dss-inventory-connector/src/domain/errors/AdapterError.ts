import { ErrorCode } from "@aos/common";
import type { AosErrorContext, AosErrorOptions } from "@aos/errors";

import type { SourceSystem } from "../value-objects/SourceSystem.js";

import { InventoryError } from "./InventoryError.js";

export interface AdapterErrorOptions extends AosErrorOptions {
  readonly source: SourceSystem;
}

/** One source adapter (`IInventorySourceAdapter`) failed or is not configured/implemented. Carries `source` in `context` so callers can tell which of the 4 adapters failed without parsing the message. */
export class AdapterError extends InventoryError {
  readonly source: SourceSystem;

  constructor(message: string, options: AdapterErrorOptions) {
    const context: AosErrorContext = { ...options.context, source: options.source };
    super(ErrorCode.UNAVAILABLE, message, { cause: options.cause, context });
    this.source = options.source;
  }
}
