import type { Result } from "@aos/common";
import type { ConnectorConfigError, MetaAdsConnectorConfig } from "@aos/meta-ads-connector";
import { parseMetaAdsConnectorConfig } from "@aos/meta-ads-connector";

import type { AaosApiConfig } from "./aaos-api.config.js";

const META_BASE_URL = "https://graph.facebook.com";

/**
 * Translates this app's `AaosApiConfig` (flat env-var shape) into
 * `@aos/meta-ads-connector`'s own `MetaAdsConnectorConfig` (its `apiVersion`/`baseUrl` are
 * literal-typed, so this still goes through `parseMetaAdsConnectorConfig`'s real Zod validation
 * rather than an unchecked cast — an operator who sets `META_API_VERSION=v20.0` gets a clear
 * `ConnectorConfigError` at startup, not a runtime surprise).
 */
export function toConnectorConfig(
  config: AaosApiConfig,
): Result<MetaAdsConnectorConfig, ConnectorConfigError> {
  return parseMetaAdsConnectorConfig({
    apiVersion: config.META_API_VERSION,
    baseUrl: META_BASE_URL,
    accessToken: config.META_ACCESS_TOKEN,
    adAccountIds: [...config.META_AD_ACCOUNT_IDS],
    webhookVerifyToken: config.META_WEBHOOK_VERIFY_TOKEN,
    webhookAppSecret: config.META_WEBHOOK_APP_SECRET,
    tenantId: config.AAOS_TENANT_ID,
  });
}
