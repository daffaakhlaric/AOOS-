import { err, ok, type Result } from "@aos/common";
import { UnavailableError } from "@aos/errors";
import type { IPublisher } from "@aos/event-bus";
import { createLogger, type Logger } from "@aos/logger";
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
 * DSS-MOTOR REAL DB-FIRST RESOLUTION (coordinator note, Part B — corrects the Phase 1B/Phase 3
 * decision below): `resolve(tenantId)` no longer special-cases `tenantId === config.AAOS_TENANT_ID`
 * to unconditionally short-circuit to the static, `.env`-composed connector. Live Supabase
 * confirmed `dss-motor`'s `tenants` row already carries a real, correctly-set
 * `meta_access_token`/`meta_ad_account_id` — the Settings page's save flow for `dss-motor` was
 * silently writing a row nothing ever read. Every tenant, INCLUDING `dss-motor`, now attempts the
 * real `tenants` lookup + `parseMetaAdsConnectorConfig` path FIRST. Only when that path reports
 * `ConnectorNotConfiguredError` (no token/ad-account-id saved yet, or the saved values fail
 * validation) AND the tenant is `dss-motor` does this fall back to composing the static context
 * from `config.META_ACCESS_TOKEN`/`config.META_AD_ACCOUNT_IDS` — `.env` is now a pure fallback
 * default for the one pre-existing tenant that predates this registry, never a permanent override.
 * (Historical note: the original Phase 1B/Phase 3 version of this doc justified the unconditional
 * short-circuit as "avoid a redundant query + avoid a live-traffic behavior change on ship day" —
 * that justification no longer holds now that `dss-motor`'s DB row is real and correctly set.)
 *
 * EYVRA-META-OAUTH-WHATSAPP-SETUP Sprint 3 — additive OAuth-preferring fallback (`encryption`
 * param, both new, optional, appended at the END of the constructor so every pre-existing 5-arg
 * call site — every real caller in `app.module.ts` plus every existing test in this file's own
 * `.spec.ts` — continues to compile and behave byte-for-byte identically; `encryption` simply
 * stays `undefined` for them, which the branch below treats exactly like "not OAuth-connected").
 * When `tenant.meta_connection_source === 'oauth'` AND a real `EncryptionService` was supplied AND
 * `tenant.meta_access_token_encrypted` is present, `resolve()` now prefers the DECRYPTED
 * OAuth-obtained token over the plain `meta_access_token` column. A tenant that is
 * `'manual'` (or has the column simply unset/null, matching every pre-Sprint-1 fixture/tenant) is
 * completely unaffected — `hasOAuthConfig` short-circuits `false` before ever touching
 * `EncryptionService`, so the existing `hasRealDbConfig`/plain-token path below runs EXACTLY as
 * before. A corrupted/undecryptable encrypted token (wrong/rotated `TOKEN_ENCRYPTION_KEY`,
 * tampered ciphertext) is caught explicitly — logged as a warning, never thrown — and honestly
 * degrades to the same plain-`meta_access_token` path a `'manual'` tenant already uses, so a
 * broken OAuth token can never break campaign creation for a tenant that also has a working manual
 * token saved.
 */
export class MetaAdsConnectorRegistry {
  private readonly cache = new Map<string, MetaAdsConnectorContext>();
  private readonly logger: Logger;

  constructor(
    private readonly tenants: TenantRepository,
    private readonly config: AaosApiConfig,
    private readonly publisher: IPublisher,
    private readonly staticConnector: MetaAdsConnector,
    private readonly webhookSecrets: WebhookSecretsService,
    private readonly encryption?: EncryptionService,
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

    // A `tenants` read failure (DB outage, network hiccup) must never make Meta Ads permanently
    // unusable for `dss-motor` — it is still allowed to fall back to `.env` on any DB error, not
    // only "no row"/"empty fields", same "an optional DB layer failing must degrade, not break"
    // discipline `WebhookSecretsService.getRowSafely()` establishes. Any OTHER tenant still gets a
    // real, honest `ConnectorNotConfiguredError` below (never an unhandled 500).
    let tenant: Awaited<ReturnType<TenantRepository["findByTenantId"]>>;
    try {
      tenant = await this.tenants.findByTenantId(tenantId);
    } catch (caught) {
      this.logger.warn(
        { tenantId, error: caught instanceof Error ? caught.message : String(caught) },
        "MetaAdsConnectorRegistry: tenants.findByTenantId failed — treating as unconfigured for this resolution",
      );
      tenant = undefined;
    }
    // OAuth-preferring branch (Sprint 3, additive) — see class doc. Never throws: a decrypt
    // failure is caught and logged, honestly degrading to the plain `meta_access_token` path below
    // exactly as if this tenant had never connected via OAuth at all.
    let oauthAccessToken: string | undefined;
    if (
      tenant !== undefined &&
      this.encryption !== undefined &&
      tenant.meta_connection_source === "oauth" &&
      tenant.meta_access_token_encrypted !== null &&
      tenant.meta_access_token_encrypted.length > 0
    ) {
      try {
        oauthAccessToken = this.encryption.decrypt(tenant.meta_access_token_encrypted);
      } catch (caught) {
        this.logger.warn(
          { tenantId, error: caught instanceof Error ? caught.message : String(caught) },
          "MetaAdsConnectorRegistry: failed to decrypt OAuth-obtained meta_access_token_encrypted — falling back to the manual meta_access_token column",
        );
        oauthAccessToken = undefined;
      }
    }
    const hasOAuthConfig =
      oauthAccessToken !== undefined &&
      tenant !== undefined &&
      tenant.meta_ad_account_id !== null &&
      tenant.meta_ad_account_id.length > 0;

    const hasRealDbConfig =
      !hasOAuthConfig &&
      tenant !== undefined &&
      tenant.meta_access_token !== null &&
      tenant.meta_access_token.length > 0 &&
      tenant.meta_ad_account_id !== null &&
      tenant.meta_ad_account_id.length > 0;

    // The global webhook verify-token/app-secret pair (coordinator note finding #4 — resolved via
    // `WebhookSecretsService`, DB-override-first/`.env`-fallback, NEVER read from `this.config`
    // directly here anymore) is baked into every composed `MetaAdsConnectorConfig` — even though no
    // currently-exercised call site reads these two fields back off a registry-resolved connector
    // (see `webhook.service.ts`'s own doc for why Meta's lead webhook stays on the STATIC
    // `META_ADS_CONNECTOR`, not this registry), keeping the composed config internally consistent
    // with the real, live-editable secret pair is still correct and cheap (cached by
    // `WebhookSecretsService` itself).
    let dbResult: ReturnType<typeof parseMetaAdsConnectorConfig> | undefined;
    if ((hasOAuthConfig || hasRealDbConfig) && tenant !== undefined) {
      const webhookSecrets = await this.webhookSecrets.getMetaSecrets();
      dbResult = parseMetaAdsConnectorConfig({
        apiVersion: tenant.meta_api_version ?? this.config.META_API_VERSION,
        baseUrl: META_BASE_URL,
        accessToken: hasOAuthConfig
          ? (oauthAccessToken as string)
          : (tenant.meta_access_token as string),
        adAccountIds: [tenant.meta_ad_account_id as string],
        webhookVerifyToken: webhookSecrets.verifyToken,
        webhookAppSecret: webhookSecrets.appSecret,
        tenantId,
      });
    }

    if (dbResult !== undefined && !dbResult.ok) {
      this.logger.warn(
        { tenantId, error: dbResult.error.message },
        "MetaAdsConnectorRegistry: tenant's saved Meta config failed MetaAdsConnectorConfig validation",
      );
    }

    if (dbResult !== undefined && dbResult.ok) {
      const connector = MetaAdsConnectorFactory.create({
        config: dbResult.value,
        publisher: this.publisher,
      });
      const context: MetaAdsConnectorContext = {
        ...connector,
        accessToken: dbResult.value.accessToken,
        adAccountIds: dbResult.value.adAccountIds,
      };
      this.cache.set(tenantId, context);
      return ok(context);
    }

    // DB path unavailable or invalid — fall back to the static, `.env`-composed connector ONLY
    // for the one pre-existing tenant that predates this registry (`dss-motor`). Any other tenant
    // with no real DB config gets a real, honest `ConnectorNotConfiguredError`.
    if (tenantId === this.config.AAOS_TENANT_ID) {
      const context: MetaAdsConnectorContext = {
        ...this.staticConnector,
        accessToken: this.config.META_ACCESS_TOKEN,
        adAccountIds: this.config.META_AD_ACCOUNT_IDS,
      };
      this.cache.set(tenantId, context);
      return ok(context);
    }

    return err(
      new ConnectorNotConfiguredError(
        tenantId,
        dbResult !== undefined && !dbResult.ok ? dbResult.error : undefined,
      ),
    );
  }

  /** Real cache invalidation — wired into `SettingsService.updateMeta` and `SuperadminService.update`/`.create` (see each's own comment) so a stale cached connector (old token/ad-account-id) never lingers past a tenant's own save. Safe to call for a tenant with nothing cached (a no-op `Map.delete`). Now DOES invalidate `dss-motor` too (coordinator note, Part B) — since `resolve` can cache a genuine DB-backed connector context for `dss-motor`, a save to its `tenants` row must invalidate that cache exactly like any other tenant; the old "never invalidate dss-motor, it's always the static env connector" reasoning no longer holds. */
  invalidate(tenantId: string): void {
    this.cache.delete(tenantId);
  }
}
