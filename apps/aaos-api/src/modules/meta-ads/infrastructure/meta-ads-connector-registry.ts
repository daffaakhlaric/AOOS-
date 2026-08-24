import { err, ok, type Result } from "@aos/common";
import { UnavailableError } from "@aos/errors";
import type { IPublisher } from "@aos/event-bus";
import { createLogger, type Logger } from "@aos/logger";
import {
  MetaAdsConnectorFactory,
  parseMetaAdsConnectorConfig,
  type MetaAdsConnector,
} from "@aos/meta-ads-connector";

import type { AaosApiConfig } from "../../../config/aaos-api.config.js";
import type { TenantRepository } from "../../superadmin/infrastructure/tenant.repository.js";

const META_BASE_URL = "https://graph.facebook.com";

/** Real, honest failure — a tenant has no `tenants.meta_access_token`/`meta_ad_account_id` set yet (or its saved values fail `MetaAdsConnectorConfig` validation). Never a thrown exception, never a silent fallback to the static single-tenant connector. */
export class ConnectorNotConfiguredError extends UnavailableError {
  constructor(tenantId: string, cause?: unknown) {
    super(`No Meta Ads connector configured for tenant "${tenantId}"`, { cause });
  }
}

/**
 * A tenant-resolved `MetaAdsConnector` PLUS the raw per-call credentials
 * (`accessToken`/`adAccountIds`) every real Meta Ads use case in this app passes explicitly at
 * call time. Confirmed by direct read of `MetaAdsConnectorFactory.create`'s return shape that the
 * composed `MetaAdsConnector` never itself retains `options.config.accessToken`/`adAccountIds` —
 * every use case (`createCampaign.execute`, `pullCampaignData.execute`, `executeVerdict.execute`,
 * etc.) takes `accessToken` as an explicit per-call parameter (the real Meta Ads Platform pattern,
 * unlike WhatsApp's connector-level baked-in token — see `WhatsAppConnectorRegistry`'s doc for
 * that contrast). A consumer resolving a tenant's connector therefore still needs its resolved
 * token/ad-account-ids in hand to actually call it. This is a structural SUPERSET of
 * `MetaAdsConnector` (assignable anywhere a plain `MetaAdsConnector` is expected), not a divergent
 * shape — `resolve()`'s own contract is still "a `MetaAdsConnector`, per tenant".
 */
export interface MetaAdsConnectorContext extends MetaAdsConnector {
  readonly accessToken: string;
  readonly adAccountIds: readonly string[];
}

/**
 * AAOS-MULTI-TENANT-PHASE1B (Phase 3) — the real per-tenant `MetaAdsConnector` resolver, replacing
 * the single static connector `app.module.ts` used to compose once at boot for every tenant.
 * Mirrors `WhatsAppConnectorRegistry`'s exact real shape (see that class's doc for the full
 * pattern this one follows), simplified per the coordinator note's finding #5: Meta Ads config is
 * ONE row per tenant on `tenants` itself (`meta_access_token`/`meta_ad_account_id`/
 * `meta_api_version`), not a one-to-many table like WhatsApp's `waba_configs` — no per-branch
 * fan-out, no multi-token-per-tenant question, no webhook-signature complexity (the coordinator
 * note's finding #5 confirms Meta Ads has no per-tenant webhook secret question in this app).
 *
 * DSS-MOTOR BACKWARD COMPAT: `resolve(tenantId)` special-cases `tenantId ===
 * config.AAOS_TENANT_ID` to return the SAME statically-composed `MetaAdsConnector`
 * `app.module.ts` already builds from `.env` (`META_ACCESS_TOKEN`/`META_AD_ACCOUNT_IDS`) — the
 * one seeded, already-live `dss-motor` tenant predates this registry and has never had its Meta
 * config backfilled into `tenants.meta_access_token`. This avoids both a redundant live Supabase
 * query for the one tenant already known at boot, and a real behavior change/outage for
 * `dss-motor`'s live Meta Ads traffic the day this phase ships.
 */
export class MetaAdsConnectorRegistry {
  private readonly cache = new Map<string, MetaAdsConnectorContext>();
  private readonly logger: Logger;

  constructor(
    private readonly tenants: TenantRepository,
    private readonly config: AaosApiConfig,
    private readonly publisher: IPublisher,
    private readonly staticConnector: MetaAdsConnector,
    logger?: Logger,
  ) {
    this.logger = logger ?? createLogger({ serviceName: "meta-ads-connector-registry" });
  }

  async resolve(
    tenantId: string,
  ): Promise<Result<MetaAdsConnectorContext, ConnectorNotConfiguredError>> {
    const cached = this.cache.get(tenantId);
    if (cached !== undefined) {
      return ok(cached);
    }

    if (tenantId === this.config.AAOS_TENANT_ID) {
      const context: MetaAdsConnectorContext = {
        ...this.staticConnector,
        accessToken: this.config.META_ACCESS_TOKEN,
        adAccountIds: this.config.META_AD_ACCOUNT_IDS,
      };
      this.cache.set(tenantId, context);
      return ok(context);
    }

    const tenant = await this.tenants.findByTenantId(tenantId);
    if (
      tenant === undefined ||
      tenant.meta_access_token === null ||
      tenant.meta_access_token.length === 0 ||
      tenant.meta_ad_account_id === null ||
      tenant.meta_ad_account_id.length === 0
    ) {
      return err(new ConnectorNotConfiguredError(tenantId));
    }

    const configResult = parseMetaAdsConnectorConfig({
      apiVersion: tenant.meta_api_version ?? this.config.META_API_VERSION,
      baseUrl: META_BASE_URL,
      accessToken: tenant.meta_access_token,
      adAccountIds: [tenant.meta_ad_account_id],
      webhookVerifyToken: this.config.META_WEBHOOK_VERIFY_TOKEN,
      webhookAppSecret: this.config.META_WEBHOOK_APP_SECRET,
      tenantId,
    });
    if (!configResult.ok) {
      this.logger.warn(
        { tenantId, error: configResult.error.message },
        "MetaAdsConnectorRegistry: tenant's saved Meta config failed MetaAdsConnectorConfig validation",
      );
      return err(new ConnectorNotConfiguredError(tenantId, configResult.error));
    }

    const connector = MetaAdsConnectorFactory.create({
      config: configResult.value,
      publisher: this.publisher,
    });
    const context: MetaAdsConnectorContext = {
      ...connector,
      accessToken: configResult.value.accessToken,
      adAccountIds: configResult.value.adAccountIds,
    };
    this.cache.set(tenantId, context);
    return ok(context);
  }

  /** Real cache invalidation — wired into `SettingsService.updateMeta` and `SuperadminService.update`/`.create` (see each's own comment) so a stale cached connector (old token/ad-account-id) never lingers past a tenant's own save. Safe to call for a tenant with nothing cached (a no-op `Map.delete`). Deliberately never invalidates the `dss-motor` static-fallback entry — that connector is process-boot-composed from `.env`, not from `tenants.meta_access_token`, so no `tenants` write can make it stale. */
  invalidate(tenantId: string): void {
    if (tenantId === this.config.AAOS_TENANT_ID) {
      return;
    }
    this.cache.delete(tenantId);
  }
}
