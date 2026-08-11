import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { MetaAdsConnectorError } from "./MetaAdsConnectorError.js";

/** The `MetaAdsConnectorConfig` failed Zod validation on construction. */
export class ConnectorConfigError extends MetaAdsConnectorError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(ErrorCode.VALIDATION_ERROR, message, options);
  }
}
