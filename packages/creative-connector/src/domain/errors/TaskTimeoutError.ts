import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { CreativeConnectorError } from "./CreativeConnectorError.js";

/** `TaskPoller.pollUntilComplete()` exceeded its `timeoutMs` (default 300_000 / 5 minutes) without the task reaching `successFlag` 1/2/3. */
export class TaskTimeoutError extends CreativeConnectorError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(ErrorCode.TIMEOUT, message, options);
  }
}
