import { randomBytes } from "node:crypto";

import { err, ok, type Result } from "@aos/common";
import { UnavailableError } from "@aos/errors";
import { Inject, Injectable, Optional } from "@nestjs/common";

import { EncryptionService } from "../../common/encryption.service.js";
import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import { AAOS_API_CONFIG } from "../../di-tokens.js";
import { MetaOAuthConfigService } from "../meta-oauth-config/meta-oauth-config.service.js";
import {
  TenantRepository,
  type TenantRow,
} from "../superadmin/infrastructure/tenant.repository.js";

import { OAuthStateRepository } from "./infrastructure/oauth-state.repository.js";
import { TokenRefreshLogRepository } from "./infrastructure/token-refresh-log.repository.js";
import { MetaAdsOAuthClient, type MetaAdAccount } from "./meta-ads-oauth-client.js";

const STATE_BYTES = 32;
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes — same real interactive-redirect time budget `modules/sosmed/oauth/oauth-state-store.ts` documents.
const REFRESH_THRESHOLD_MS = 10 * 24 * 60 * 60 * 1000; // 10 days — the spec's own real threshold.

export class MetaOAuthError extends UnavailableError {}

export interface MetaOAuthConnectResult {
  readonly authorizeUrl: string;
}

export interface MetaOAuthCallbackResult {
  readonly success: boolean;
  readonly message: string;
}

/**
 * `modules/meta-oauth` — Sprint 2 (EYVRA-META-OAUTH-WHATSAPP-SETUP) real Facebook Login (Meta Ads
 * scope) OAuth orchestration. Adapted from the pasted spec's Prompt 3, but against THIS codebase's
 * real primitives:
 *   - `MetaOAuthConfigService` (not raw `process.env.META_APP_ID`/`META_APP_SECRET`) — the real,
 *     DB-first/`.env`-fallback resolver Sprint 1 built for the GLOBAL Meta App credentials.
 *   - `EncryptionService` (AES-256-GCM) for `tenants.meta_access_token_encrypted` — never a
 *     plaintext token at rest for an OAuth-obtained credential.
 *   - `OAuthStateRepository`/`oauth_states` — a real, durable, single-use, expiring DB row (not
 *     the in-memory `Map` `modules/sosmed`'s `OAuthStateStore` uses) — this sprint's own migration
 *     already provisioned this table specifically for this purpose.
 *   - `TenantRepository`/`tenants` — the real per-tenant row, not a `meta_connections` table (see
 *     `049_meta_oauth_foundation.sql`'s header for why).
 *   - `TokenRefreshLogRepository`/`token_refresh_log` — real audit trail for `refreshTokenIfNeeded`.
 *
 * CRITICAL SCOPE BOUNDARY (explicit, re-verified in this file's own tests): `getToken` is a
 * self-contained capability. `MetaAdsConnectorRegistry.resolve(tenantId)` (`modules/meta-ads/
 * infrastructure/meta-ads-connector-registry.ts`) is NOT modified to call it — wiring the registry
 * to read these new OAuth columns (with graceful fallback to the existing manual columns) is
 * explicitly Sprint 3's job, not this one.
 */
@Injectable()
export class MetaOAuthService {
  private readonly client: MetaAdsOAuthClient | undefined;

  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    private readonly metaOAuthConfig: MetaOAuthConfigService,
    private readonly encryption: EncryptionService,
    private readonly tenants: TenantRepository,
    private readonly oauthStates: OAuthStateRepository,
    private readonly tokenRefreshLog: TokenRefreshLogRepository,
    // `@Optional()` test seam — same precedent `modules/sosmed/application/sosmed-oauth.service.ts`
    // establishes for `metaOAuthClientOverride`/`now`: never Nest-provided in real composition, lets
    // specs inject a client built with a fake `fetchImpl` instead of exercising real network calls.
    @Optional() metaAdsOAuthClientOverride?: MetaAdsOAuthClient,
    @Optional() private readonly now: () => Date = () => new Date(),
  ) {
    this.client = metaAdsOAuthClientOverride;
  }

  private requireRedirectBase(): string {
    if (this.config.AAOS_API_BASE_URL.length === 0) {
      throw new UnavailableError(
        "AAOS_API_BASE_URL is not configured — required to build the Meta OAuth redirect_uri.",
      );
    }
    return this.config.AAOS_API_BASE_URL.replace(/\/+$/, "");
  }

  private async requireClient(): Promise<MetaAdsOAuthClient> {
    if (this.client !== undefined) {
      return this.client;
    }
    const appConfig = await this.metaOAuthConfig.getMetaAppConfig();
    if (appConfig.appId.length === 0 || appConfig.appSecret.length === 0) {
      throw new UnavailableError(
        "Meta OAuth is not configured — meta_app_id/meta_app_secret are unset (system_meta_oauth_config and .env fallback both empty).",
      );
    }
    return new MetaAdsOAuthClient({
      appId: appConfig.appId,
      appSecret: appConfig.appSecret,
      apiVersion: this.config.META_API_VERSION,
    });
  }

  /** `GET /oauth/meta/connect?tenantId=` — generates a real CSRF `state`, persists it to `oauth_states`, and returns Meta's real consent-dialog URL. */
  async generateOAuthUrl(tenantId: string): Promise<MetaOAuthConnectResult> {
    const client = await this.requireClient();
    const state = randomBytes(STATE_BYTES).toString("hex");
    const nowMs = this.now().getTime();
    await this.oauthStates.create({
      tenant_id: tenantId,
      state,
      redirect_after: null,
      expires_at: new Date(nowMs + STATE_TTL_MS).toISOString(),
    });
    const redirectUri = `${this.requireRedirectBase()}/oauth/meta/callback`;
    return { authorizeUrl: client.buildAuthorizeUrl({ redirectUri, state }) };
  }

  /** `GET /oauth/meta/callback` — PUBLIC (Meta redirects the manager's own browser here). Real state validation, code -> short-lived -> long-lived exchange, `/me` + `/me/adaccounts` discovery, encrypted persistence onto the real `tenants` row. */
  async handleCallback(
    code: string | undefined,
    state: string | undefined,
    oauthError: string | undefined,
  ): Promise<MetaOAuthCallbackResult> {
    if (oauthError !== undefined) {
      return { success: false, message: `Meta OAuth was denied or errored: ${oauthError}` };
    }
    if (code === undefined || state === undefined) {
      return { success: false, message: "Incomplete Meta OAuth callback (code/state missing)." };
    }

    const stateRow = await this.oauthStates.consume(state, this.now());
    if (stateRow === undefined) {
      return { success: false, message: "OAuth state is invalid, already used, or expired." };
    }
    const tenantId = stateRow.tenant_id;
    const tenant = await this.tenants.findByTenantId(tenantId);
    if (!tenant) return { success: false, message: "Workspace unavailable" };

    let client: MetaAdsOAuthClient;
    try {
      client = await this.requireClient();
    } catch (caught) {
      return { success: false, message: describeCause(caught) };
    }
    const redirectUri = `${this.requireRedirectBase()}/oauth/meta/callback`;

    const shortLived = await client.exchangeCodeForToken({ code, redirectUri });
    if (!shortLived.ok) {
      return {
        success: false,
        message: `Failed to exchange authorization code: ${shortLived.error.message}`,
      };
    }
    const longLived = await client.exchangeForLongLivedToken({
      shortLivedToken: shortLived.value.accessToken,
    });
    if (!longLived.ok) {
      return {
        success: false,
        message: `Failed to exchange for a long-lived token: ${longLived.error.message}`,
      };
    }

    const me = await client.getMe({ accessToken: longLived.value.accessToken });
    if (!me.ok) {
      return { success: false, message: `Failed to fetch Meta identity: ${me.error.message}` };
    }

    const adAccountsResult = await client.getAdAccounts({
      accessToken: longLived.value.accessToken,
    });
    const adAccounts: readonly MetaAdAccount[] = adAccountsResult.ok ? adAccountsResult.value : [];

    const expiresAt =
      longLived.value.expiresInSeconds !== undefined
        ? new Date(this.now().getTime() + longLived.value.expiresInSeconds * 1000).toISOString()
        : null;

    const encryptedToken = this.encryption.encrypt(longLived.value.accessToken);

    await this.tenants.updateMetaAtVersion(tenantId, tenant.meta_credential_version ?? 0, {
      meta_access_token_encrypted: encryptedToken,
      meta_access_token: null,
      meta_token_expires_at: expiresAt,
      meta_connection_source: "oauth",
      meta_fb_user_id: me.value.fbUserId,
      meta_fb_user_name: me.value.fbUserName ?? null,
      // New credentials require explicit resource selection, even for a single account.
      meta_ad_account_id: null,
      meta_page_id: null,
      meta_instagram_id: null,
      meta_whatsapp_destination: null,
    });

    return {
      success: true,
      message: `Meta credential saved — ${String(adAccounts.length)} ad account(s) found; select and verify one in Settings.`,
    };
  }

  /**
   * Re-exchanges the tenant's stored long-lived token for a fresh one when it is within
   * `REFRESH_THRESHOLD_MS` (10 days) of expiry — a genuine no-op (never throws, never logs) for a
   * tenant with no OAuth connection or a token that isn't near expiry yet. Always writes a real
   * `token_refresh_log` row on an ACTUAL refresh attempt (success or failure); writes nothing when
   * no refresh was attempted at all.
   */
  async refreshTokenIfNeeded(
    tenantId: string,
  ): Promise<Result<{ readonly refreshed: boolean }, MetaOAuthError>> {
    const tenant = await this.tenants.findByTenantId(tenantId);
    if (tenant === undefined || tenant.meta_connection_source !== "oauth") {
      return ok({ refreshed: false });
    }
    const expectedCredentialVersion = tenant.meta_credential_version ?? 0;
    if (
      tenant.meta_access_token_encrypted === null ||
      tenant.meta_access_token_encrypted === undefined ||
      tenant.meta_access_token_encrypted.length === 0
    ) {
      return ok({ refreshed: false });
    }
    if (tenant.meta_token_expires_at === null || tenant.meta_token_expires_at === undefined) {
      // No known expiry — nothing honest to compare the 10-day threshold against; skip rather than
      // guess.
      return ok({ refreshed: false });
    }
    const expiresAtMs = new Date(tenant.meta_token_expires_at).getTime();
    if (expiresAtMs - this.now().getTime() > REFRESH_THRESHOLD_MS) {
      return ok({ refreshed: false });
    }

    let client: MetaAdsOAuthClient;
    try {
      client = await this.requireClient();
    } catch (caught) {
      const message = describeCause(caught);
      await this.tokenRefreshLog.insert({
        tenant_id: tenantId,
        connection_type: "meta",
        success: false,
        error_message: message,
        new_expires_at: null,
      });
      return err(new MetaOAuthError(message));
    }

    const currentToken = this.encryption.decrypt(tenant.meta_access_token_encrypted);
    const refreshed = await client.exchangeForLongLivedToken({ shortLivedToken: currentToken });
    if (!refreshed.ok) {
      await this.tokenRefreshLog.insert({
        tenant_id: tenantId,
        connection_type: "meta",
        success: false,
        error_message: refreshed.error.message,
        new_expires_at: null,
      });
      return err(new MetaOAuthError(`Meta token refresh failed: ${refreshed.error.message}`));
    }

    const newExpiresAt =
      refreshed.value.expiresInSeconds !== undefined
        ? new Date(this.now().getTime() + refreshed.value.expiresInSeconds * 1000).toISOString()
        : tenant.meta_token_expires_at;
    await this.tenants.updateMetaAtVersion(tenantId, expectedCredentialVersion, {
      meta_access_token_encrypted: this.encryption.encrypt(refreshed.value.accessToken),
      meta_last_refreshed_at: new Date().toISOString(),
      meta_token_expires_at: newExpiresAt,
    });
    await this.tokenRefreshLog.insert({
      tenant_id: tenantId,
      connection_type: "meta",
      success: true,
      error_message: null,
      new_expires_at: newExpiresAt,
    });
    return ok({ refreshed: true });
  }

  /**
   * Decrypts and returns the tenant's current OAuth-obtained Meta access token, refreshing it
   * first if it's within the real 10-day threshold. NOT wired into `MetaAdsConnectorRegistry`
   * this sprint — see this class's own doc for why.
   */
  async getToken(tenantId: string): Promise<string> {
    const refresh = await this.refreshTokenIfNeeded(tenantId);
    if (!refresh.ok) throw new UnavailableError("Meta credential refresh failed");
    const tenant = await this.tenants.findByTenantId(tenantId);
    if (
      tenant === undefined ||
      tenant.meta_access_token_encrypted === null ||
      tenant.meta_access_token_encrypted === undefined ||
      tenant.meta_access_token_encrypted.length === 0
    ) {
      throw new UnavailableError(`Tenant "${tenantId}" has no OAuth-connected Meta token.`);
    }
    return this.encryption.decrypt(tenant.meta_access_token_encrypted);
  }

  /** Disconnect clears both credential formats and selected destinations atomically. */
  async disconnect(tenantId: string): Promise<void> {
    const tenant = await this.tenants.findByTenantId(tenantId);
    if (!tenant) throw new UnavailableError("Workspace unavailable");
    await this.tenants.updateMetaAtVersion(tenantId, tenant.meta_credential_version ?? 0, {
      meta_connection_source: "manual",
      meta_access_token: null,
      meta_integration_status: "DISCONNECTED",
      meta_access_token_encrypted: null,
      meta_token_expires_at: null,
      meta_fb_user_id: null,
      meta_fb_user_name: null,
      meta_ad_account_id: null,
      meta_page_id: null,
      meta_instagram_id: null,
      meta_whatsapp_destination: null,
    });
  }

  /** Real, honest status read for `GET /oauth/status/:tenantId` — never throws for an unknown tenant, reports `connected: false`. */
  async getMetaStatus(tenantId: string): Promise<{
    readonly connected: boolean;
    readonly source: "manual" | "oauth";
    readonly fbUserName?: string;
    readonly tokenExpiresAt?: string;
    readonly adAccountId?: string;
  }> {
    const tenant = await this.tenants.findByTenantId(tenantId);
    if (tenant === undefined) {
      return { connected: false, source: "manual" };
    }
    return metaStatusFromTenant(tenant);
  }
}

function metaStatusFromTenant(tenant: TenantRow): {
  readonly connected: boolean;
  readonly source: "manual" | "oauth";
  readonly fbUserName?: string;
  readonly tokenExpiresAt?: string;
  readonly adAccountId?: string;
} {
  const source = tenant.meta_connection_source === "oauth" ? "oauth" : "manual";
  const connected =
    tenant.meta_integration_status === "CONNECTED" &&
    Boolean(tenant.meta_access_token_encrypted) &&
    Boolean(tenant.meta_ad_account_id);
  return {
    connected,
    source,
    ...(tenant.meta_fb_user_name !== null ? { fbUserName: tenant.meta_fb_user_name } : {}),
    ...(tenant.meta_token_expires_at !== null
      ? { tokenExpiresAt: tenant.meta_token_expires_at }
      : {}),
    ...(tenant.meta_ad_account_id !== null ? { adAccountId: tenant.meta_ad_account_id } : {}),
  };
}

function describeCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
