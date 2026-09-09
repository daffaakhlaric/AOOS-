import { UnavailableError, ValidationError } from "@aos/errors";
import { Inject, Injectable, Optional } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import { AAOS_API_CONFIG, WEBHOOK_SECRETS_SERVICE } from "../../di-tokens.js";
import type { WabaConfigRow } from "../settings/infrastructure/waba-config.repository.js";
import { WabaConfigRepository } from "../settings/infrastructure/waba-config.repository.js";
import { testWabaConnection } from "../settings/infrastructure/waba-connection-tester.js";
import type { WebhookSecretsService } from "../webhook-config/webhook-secrets.service.js";

import { WaGraphClient } from "./wa-graph-client.js";

export interface WaOAuthResult {
  readonly success: boolean;
  readonly message: string;
}

/**
 * `modules/meta-oauth` — Sprint 2 (EYVRA-META-OAUTH-WHATSAPP-SETUP) real WhatsApp Business
 * Embedded Signup + manual-setup orchestration. Adapted from the pasted spec's Prompt 4, against
 * this codebase's REAL `waba_configs` schema (`007_tenants_waba.sql` + `049_meta_oauth_foundation
 * .sql`'s additive `config_source`/`webhook_verified`/`webhook_verified_at`/`fb_user_id`/
 * `fb_user_name` columns) rather than the spec's literal shape.
 *
 * ---------------------------------------------------------------------------------------------
 * DELIBERATE DEVIATION FROM THE PASTED SPEC, documented per this dispatch's own discipline: the
 * spec says "encrypt the token" before upserting onto `waba_configs`. Investigated first —
 * `waba_configs.access_token` has NO sibling `*_encrypted` column (unlike `tenants`, which Sprint
 * 1's migration deliberately gave a NEW `meta_access_token_encrypted` column specifically so
 * `MetaAdsConnectorRegistry` would never need to change to decrypt on read — see that migration's
 * own header). `WhatsAppConnectorRegistry.resolve()` reads `waba_configs.access_token` as PLAIN
 * TEXT today (`parseWhatsAppConnectorConfig({ accessToken: rows[0]?.access_token ?? "" })`) and
 * this sprint's explicit, non-negotiable boundary is "do NOT modify `WhatsAppConnectorRegistry` or
 * any of its callers". Writing an `EncryptionService`-encrypted envelope into that same plaintext
 * column would silently break every tenant's outbound WhatsApp sending the next time the registry
 * resolves a connector for them (it would hand `@aos/whatsapp-connector` a ciphertext string as a
 * literal Bearer token). So this file keeps `waba_configs.access_token` PLAIN TEXT, matching the
 * real, already-working manual-entry flow (`SettingsService`/`WabaConfigRepository`) exactly —
 * relying on Supabase's own at-rest encryption, the same real precedent
 * `modules/sosmed/application/sosmed-oauth.service.ts`'s own class doc (point 1) already
 * establishes for an analogous real "Page/WABA access token in a plain-TEXT column" situation.
 * Adding a genuine app-level encrypted column for `waba_configs` (mirroring `tenants`) is a clean
 * follow-up for whichever LATER sprint actually wires `WhatsAppConnectorRegistry` to read OAuth
 * columns (Sprint 3, per this dispatch's own scope boundary) — it can add the column AND the
 * decrypt-on-read change in the same migration/PR, never split across two.
 * ---------------------------------------------------------------------------------------------
 */
@Injectable()
export class WaOAuthService {
  private readonly client: WaGraphClient;

  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    private readonly wabaConfigs: WabaConfigRepository,
    @Inject(WEBHOOK_SECRETS_SERVICE) private readonly webhookSecrets: WebhookSecretsService,
    // `@Optional()` test seam — same precedent as `MetaOAuthService`'s `metaAdsOAuthClientOverride`.
    @Optional() waGraphClientOverride?: WaGraphClient,
    @Optional() private readonly now: () => Date = () => new Date(),
  ) {
    this.client =
      waGraphClientOverride ?? new WaGraphClient({ apiVersion: this.config.META_API_VERSION });
  }

  /**
   * `POST /oauth/wa/embedded-signup` — verifies the token the Embedded Signup JS SDK handed back
   * to the dashboard's browser (`/debug_token`), discovers the WABA + its first phone number
   * (`/me/whatsapp_business_accounts`, `/{wabaId}/phone_numbers`), and upserts a `waba_configs` row
   * with `config_source: 'embedded_signup'`.
   */
  async handleEmbeddedSignupToken(
    tenantId: string,
    token: string,
    branchId: string,
  ): Promise<WaOAuthResult> {
    if (this.config.META_APP_ID.length === 0 || this.config.META_APP_SECRET.length === 0) {
      return {
        success: false,
        message: "Meta OAuth is not configured — META_APP_ID/META_APP_SECRET are unset.",
      };
    }
    const appAccessToken = `${this.config.META_APP_ID}|${this.config.META_APP_SECRET}`;

    const debugResult = await this.client.debugToken({ inputToken: token, appAccessToken });
    if (!debugResult.ok) {
      return { success: false, message: `Failed to verify token: ${debugResult.error.message}` };
    }
    if (!debugResult.value.isValid) {
      return {
        success: false,
        message: "The provided WhatsApp Embedded Signup token is not valid.",
      };
    }

    const wabasResult = await this.client.getWhatsAppBusinessAccounts({ accessToken: token });
    if (!wabasResult.ok) {
      return {
        success: false,
        message: `Failed to fetch WhatsApp Business Accounts: ${wabasResult.error.message}`,
      };
    }
    const waba = wabasResult.value[0];
    if (waba === undefined) {
      return {
        success: false,
        message: "This token does not manage any WhatsApp Business Account.",
      };
    }

    const phoneNumbersResult = await this.client.getPhoneNumbers({
      wabaId: waba.wabaId,
      accessToken: token,
    });
    if (!phoneNumbersResult.ok) {
      return {
        success: false,
        message: `Failed to fetch phone numbers: ${phoneNumbersResult.error.message}`,
      };
    }
    const phoneNumber = phoneNumbersResult.value[0];
    if (phoneNumber === undefined) {
      return { success: false, message: "This WhatsApp Business Account has no phone numbers." };
    }

    await this.upsertWabaConfig({
      tenantId,
      branchId,
      wabaId: waba.wabaId,
      phoneNumberId: phoneNumber.phoneNumberId,
      phoneNumber: phoneNumber.displayPhoneNumber ?? "",
      accessToken: token,
      configSource: "embedded_signup",
      fbUserId: undefined,
      fbUserName: waba.name,
    });

    // Prompt 4's final step ("registerWebhook: real POST to {wabaId}/subscribed_apps") has no
    // dedicated route in Prompt 5's controller list — the natural real-world trigger is
    // immediately after a successful Embedded Signup, using the SAME signup token (still valid,
    // still in hand). A webhook-registration failure here is real, honest, and reported in the
    // message, but never fails the overall signup — the WABA row is already saved and usable for
    // OUTBOUND sending even if this one follow-up call fails; the user can retry via `/settings`.
    const webhookResult = await this.registerWebhook(
      tenantId,
      token,
      waba.wabaId,
      phoneNumber.phoneNumberId,
    );

    return {
      success: true,
      message: webhookResult.success
        ? `WhatsApp connected via Embedded Signup — ${waba.name ?? waba.wabaId}. Webhook registered.`
        : `WhatsApp connected via Embedded Signup — ${waba.name ?? waba.wabaId}. Webhook registration failed: ${webhookResult.message}`,
    };
  }

  /** `POST /oauth/wa/manual` — real credentials typed by hand, verified against Meta's phone-number-status endpoint (`testWabaConnection`, the same real check `/settings`'s "Test" button already uses) before being saved. */
  async setupManual(
    tenantId: string,
    dto: {
      readonly branchId: string;
      readonly wabaId: string;
      readonly phoneNumberId: string;
      readonly phoneNumber: string;
      readonly accessToken: string;
    },
  ): Promise<WaOAuthResult> {
    const test = await testWabaConnection(
      dto.phoneNumberId,
      dto.accessToken,
      this.config.META_API_VERSION,
    );
    if (!test.success) {
      return { success: false, message: test.message };
    }

    await this.upsertWabaConfig({
      tenantId,
      branchId: dto.branchId,
      wabaId: dto.wabaId,
      phoneNumberId: dto.phoneNumberId,
      phoneNumber: dto.phoneNumber,
      accessToken: dto.accessToken,
      configSource: "manual",
      fbUserId: undefined,
      fbUserName: undefined,
    });

    return { success: true, message: test.message };
  }

  /** Real `POST /{wabaId}/subscribed_apps` — subscribes this app's webhook to the WABA's events, then marks the matching `waba_configs` row `webhook_verified: true`. */
  async registerWebhook(
    tenantId: string,
    token: string,
    wabaId: string,
    phoneId: string,
  ): Promise<WaOAuthResult> {
    const result = await this.client.registerWebhookSubscription({ wabaId, accessToken: token });
    if (!result.ok) {
      return {
        success: false,
        message: `Failed to register webhook subscription: ${result.error.message}`,
      };
    }
    const row = await this.wabaConfigs.findByPhoneNumberId(phoneId);
    if (row === undefined || row.tenant_id !== tenantId) {
      return {
        success: false,
        message:
          "Webhook subscription registered with Meta, but no matching waba_configs row was found to mark verified.",
      };
    }
    await this.wabaConfigs.updateById(row.id, {
      webhook_verified: true,
      webhook_verified_at: this.now().toISOString(),
    });
    return { success: true, message: "Webhook registered and verified." };
  }

  /**
   * `GET /oauth/webhook/wa/:tenantId` — `hub.mode`/`hub.verify_token` handshake. Reuses
   * `WebhookSecretsService.getWhatsappSecrets().verifyToken` — this codebase's REAL, already-
   * established WhatsApp webhook-verify-token concept (`WhatsAppWebhookService.verifyHandshake`
   * uses the exact same call) — rather than inventing a second verify-token concept, per this
   * dispatch's own explicit instruction to investigate and reuse.
   */
  async verifyWebhook(
    mode: string | undefined,
    token: string | undefined,
    challenge: string | undefined,
  ): Promise<
    | { readonly ok: true; readonly challenge: string }
    | { readonly ok: false; readonly message: string }
  > {
    if (mode !== "subscribe" || token === undefined || challenge === undefined) {
      return { ok: false, message: "Missing or invalid hub.mode/hub.verify_token/hub.challenge." };
    }
    const { verifyToken } = await this.webhookSecrets.getWhatsappSecrets();
    if (token !== verifyToken) {
      return { ok: false, message: "hub.verify_token mismatch." };
    }
    return { ok: true, challenge };
  }

  /** Real status read for `GET /oauth/status/:tenantId`'s `whatsapp` field — every real `waba_configs` row for this tenant, never throws for a tenant with none. */
  async getStatus(tenantId: string): Promise<{
    readonly connected: boolean;
    readonly configs: ReadonlyArray<{
      readonly id: string;
      readonly branchId: string;
      readonly source: "manual" | "embedded_signup";
      readonly webhookVerified: boolean;
    }>;
  }> {
    const rows = await this.wabaConfigs.listByTenant(tenantId);
    return {
      connected: rows.some((row) => row.status === "ACTIVE"),
      configs: rows.map((row) => ({
        id: row.id,
        branchId: row.branch_id,
        source: row.config_source,
        webhookVerified: row.webhook_verified,
      })),
    };
  }

  /** Real, plain-text token read for a tenant's first ACTIVE `waba_configs` row — see this class's own doc for why this is plain text, not `EncryptionService`-decrypted, matching the real column's current state. */
  async getToken(tenantId: string): Promise<string> {
    const rows = await this.wabaConfigs.listByTenant(tenantId);
    const active = rows.find((row) => row.status === "ACTIVE");
    if (active === undefined) {
      throw new UnavailableError(
        `Tenant "${tenantId}" has no ACTIVE WhatsApp Business Account configured.`,
      );
    }
    return active.access_token;
  }

  private async upsertWabaConfig(params: {
    readonly tenantId: string;
    readonly branchId: string;
    readonly wabaId: string;
    readonly phoneNumberId: string;
    readonly phoneNumber: string;
    readonly accessToken: string;
    readonly configSource: "manual" | "embedded_signup";
    readonly fbUserId: string | undefined;
    readonly fbUserName: string | undefined;
  }): Promise<WabaConfigRow> {
    if (params.phoneNumber.length === 0) {
      throw new ValidationError("A resolved phone number is required to save a waba_configs row.");
    }
    const existing = await this.wabaConfigs.findByPhoneNumberId(params.phoneNumberId);
    if (existing !== undefined) {
      return this.wabaConfigs.updateById(existing.id, {
        branch_id: params.branchId,
        phone_number: params.phoneNumber,
        waba_id: params.wabaId,
        access_token: params.accessToken,
        status: "ACTIVE",
        config_source: params.configSource,
        webhook_verified: false,
        webhook_verified_at: null,
        fb_user_id: params.fbUserId ?? null,
        fb_user_name: params.fbUserName ?? null,
      });
    }
    return this.wabaConfigs.insert({
      tenant_id: params.tenantId,
      branch_id: params.branchId,
      phone_number: params.phoneNumber,
      waba_id: params.wabaId,
      phone_number_id: params.phoneNumberId,
      access_token: params.accessToken,
      status: "ACTIVE",
      config_source: params.configSource,
      webhook_verified: false,
      webhook_verified_at: null,
      fb_user_id: params.fbUserId ?? null,
      fb_user_name: params.fbUserName ?? null,
    });
  }
}
