import { err, ok, type Result } from "@aos/common";
import { UnavailableError } from "@aos/errors";
import type { IPublisher } from "@aos/event-bus";
import { type Logger } from "@aos/logger";
import {
  MetaAdsConnectorFactory,
  parseMetaAdsConnectorConfig,
  type MetaAdsConnector,
} from "@aos/meta-ads-connector";

import type { EncryptionService } from "../../../common/encryption.service.js";
import type { AaosApiConfig } from "../../../config/aaos-api.config.js";
import type { TenantRepository } from "../../superadmin/infrastructure/tenant.repository.js";
import type { WebhookSecretsService } from "../../webhook-config/webhook-secrets.service.js";

const META_BASE_URL = "https://graph.facebook.com";

/** Real, honest failure — a tenant has no `tenants.meta_access_token`/`meta_ad_account_id` set yet (or its saved values fail `MetaAdsConnectorConfig` validation). Never a thrown exception, never a silent fallback to the static single-tenant connector. */
export class ConnectorNotConfiguredError extends UnavailableError {
  constructor(tenantId: string, cause?: unknown) {
    super(`No Meta Ads connector configured for tenant "${tenantId}"`, { cause });
  }
}

export interface MetaAdsConnectorContext extends MetaAdsConnector {
  readonly accessToken: string;
  readonly adAccountIds: readonly string[];
  readonly tenantId?: string;
  readonly integrationId?: string;
  readonly credentialVersion?: number;
  readonly credentialSource?: string;
  readonly selectedPageId?: string;
}
/** Every resolve reads DB state. A process-local connector is reused only for the same immutable configuration fingerprint. */
export class MetaAdsConnectorRegistry {
  private readonly cache = new Map<
    string,
    { fingerprint: string; context: MetaAdsConnectorContext }
  >();
  constructor(
    private readonly tenants: TenantRepository,
    private readonly config: AaosApiConfig,
    private readonly publisher: IPublisher,
    _staticConnector: MetaAdsConnector,
    private readonly webhookSecrets: WebhookSecretsService,
    private readonly encryption?: EncryptionService,
    _logger?: Logger,
  ) {}
  async resolve(
    tenantId: string,
  ): Promise<Result<MetaAdsConnectorContext, ConnectorNotConfiguredError>> {
    try {
      if (!tenantId) return err(new ConnectorNotConfiguredError("missing"));
      const tenant = await this.tenants.findByTenantId(tenantId);
      if (
        !tenant ||
        tenant.status === "SUSPENDED" ||
        tenant.meta_integration_status === "DISCONNECTED" ||
        !tenant.meta_ad_account_id ||
        !tenant.meta_access_token_encrypted ||
        !this.encryption ||
        !tenant.meta_credential_version
      ) {
        this.invalidate(tenantId);
        return err(new ConnectorNotConfiguredError(tenantId));
      }
      const fingerprint = JSON.stringify([
        tenant.meta_credential_version,
        tenant.meta_access_token_encrypted,
        tenant.meta_ad_account_id,
        tenant.meta_page_id,
        tenant.meta_api_version,
        tenant.meta_connection_source,
      ]);
      const cached = this.cache.get(tenantId);
      if (cached?.fingerprint === fingerprint) return ok(cached.context);
      const accessToken = this.encryption.decrypt(tenant.meta_access_token_encrypted);
      const secrets = await this.webhookSecrets.getMetaSecrets();
      const parsed = parseMetaAdsConnectorConfig({
        apiVersion: tenant.meta_api_version ?? this.config.META_API_VERSION,
        baseUrl: META_BASE_URL,
        accessToken,
        adAccountIds: [tenant.meta_ad_account_id],
        webhookVerifyToken: secrets.verifyToken,
        webhookAppSecret: secrets.appSecret,
        tenantId,
      });
      if (!parsed.ok) return err(new ConnectorNotConfiguredError(tenantId));
      const connector = MetaAdsConnectorFactory.create({
        config: parsed.value,
        publisher: this.publisher,
      });
      const context: MetaAdsConnectorContext = {
        ...connector,
        accessToken,
        adAccountIds: parsed.value.adAccountIds,
        tenantId,
        integrationId: tenant.id,
        credentialVersion: tenant.meta_credential_version,
        credentialSource: tenant.meta_connection_source,
        ...(tenant.meta_page_id ? { selectedPageId: tenant.meta_page_id } : {}),
      };
      this.cache.set(tenantId, { fingerprint, context });
      return ok(context);
    } catch {
      this.invalidate(tenantId);
      return err(new ConnectorNotConfiguredError(tenantId));
    }
  }
  invalidate(tenantId: string): void {
    this.cache.delete(tenantId);
  }
}
