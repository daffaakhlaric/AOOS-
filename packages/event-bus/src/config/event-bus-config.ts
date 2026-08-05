import type { IRetryPolicy } from "../contracts/retry-policy.js";

export interface EventBusConfig {
  readonly defaultRetryPolicy?: IRetryPolicy;
  /** SemVer range every published event's `schemaVersion` must satisfy. Unset accepts any. */
  readonly supportedSchemaVersionRange?: string;
  /** Tenant Isolation allowlist — unset means every tenant is accepted. */
  readonly allowedTenantIds?: readonly string[];
  readonly maxBatchSize?: number;
}

export const DEFAULT_EVENT_BUS_CONFIG: Required<Pick<EventBusConfig, "maxBatchSize">> = {
  maxBatchSize: 500,
};
