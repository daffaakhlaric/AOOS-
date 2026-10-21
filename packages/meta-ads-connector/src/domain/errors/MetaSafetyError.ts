import { MetaApiError } from "./MetaApiError.js";
export type MetaSafetyCode =
  | "META_AUTH_ERROR"
  | "META_PERMISSION_ERROR"
  | "META_RATE_LIMIT"
  | "META_INVALID_PARAMETER"
  | "META_RESOURCE_NOT_FOUND"
  | "META_ACCOUNT_MISMATCH"
  | "META_VALIDATION_ERROR"
  | "META_TRANSIENT_ERROR"
  | "META_WRITE_UNCERTAIN"
  | "META_PROVIDER_ERROR"
  | "META_WRITE_DISABLED"
  | "META_WRITE_CONTEXT_REQUIRED"
  | "BUDGET_WRITE_UNVERIFIED";
/** Never retry uncertain writes. No raw provider message, URL or credential in this error. */
export class MetaSafetyError extends MetaApiError {
  readonly retryable = false;
  constructor(
    readonly normalizedCode: MetaSafetyCode,
    readonly providerMetadata: Readonly<Record<string, string | number>> = {},
  ) {
    super(normalizedCode);
  }
}
