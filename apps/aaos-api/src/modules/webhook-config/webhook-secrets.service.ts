import { createLogger, type Logger } from "@aos/logger";
import { Inject, Injectable } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import { AAOS_API_CONFIG } from "../../di-tokens.js";
import type { SystemWebhookConfigRepository } from "../superadmin/infrastructure/system-webhook-config.repository.js";

export interface WebhookSecretPair {
  readonly verifyToken: string;
  readonly appSecret: string;
}

/**
 * `modules/webhook-config` — deliberately a SMALL, STANDALONE module (not hosted inside
 * `SuperadminModule`, even though `SystemWebhookConfigRepository` itself lives under
 * `superadmin/infrastructure/`), per `docs/PROMPT-AAOS-SETTINGS-WEBHOOK-CONFIG.md` Part C item 3's
 * explicit caution: `WebhookModule`/`WhatsAppWebhookModule` (this service's real consumers) must
 * never need to import `SuperadminModule` to reach it — that would be a real circular-import risk
 * this codebase has no precedent for. Mirrors how `MetaAdsConnectorRegistry`/
 * `WhatsAppConnectorRegistry` are actually composed in this app: NOT inside a dedicated Nest
 * module of their own, but plain-constructed once in `app.module.ts`'s `forRoot` (the composition
 * root) and exposed to the rest of the app as a single `global: true` DI token
 * (`WEBHOOK_SECRETS_SERVICE`, `di-tokens.ts`) — so every real consumer (the two signature guards,
 * `WebhookService`/`WhatsAppWebhookService` via Nest DI, AND both connector registries via a plain
 * constructor argument, since they're composed the same `new`-in-`forRoot` way) shares the exact
 * same instance and therefore the exact same in-memory cache. No module file needs to import
 * another module's file to use this service.
 *
 * Real, small, in-memory-cached singleton — a single cached object per secret pair (Meta,
 * WhatsApp), not a `Map`: this is one GLOBAL value (coordinator note finding #4 — one Meta
 * App/WhatsApp BSP app receives every tenant's webhook traffic under one shared secret), never
 * per-tenant. `getMetaSecrets()`/`getWhatsappSecrets()` each: return the cached pair if present;
 * else read `SystemWebhookConfigRepository.get()` once, prefer each DB column when it's a real
 * non-empty string, else fall back to the matching `.env` value; cache the resolved pair; return
 * it. `invalidate()` clears BOTH cached pairs unconditionally — simplest correct behavior for a
 * value this rarely written (the superadmin webhook-config `PUT` endpoint calls it on every save),
 * no need to track/invalidate each pair independently. A `SystemWebhookConfigRepository.get()`
 * failure (network hiccup, table not yet migrated) is caught and logged, never thrown — see
 * `getRowSafely()`'s own doc: a webhook signature-verification path must never turn a transient
 * config-table read failure into every webhook request failing.
 */
@Injectable()
export class WebhookSecretsService {
  private metaCache: WebhookSecretPair | undefined;
  private whatsappCache: WebhookSecretPair | undefined;
  private readonly logger: Logger;

  constructor(
    private readonly repository: SystemWebhookConfigRepository,
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    logger?: Logger,
  ) {
    this.logger = logger ?? createLogger({ serviceName: "webhook-secrets-service" });
  }

  /**
   * A webhook signature-verification path must never become fragile to a transient
   * `system_webhook_config` read failure — better to silently fall back to `.env` (this table's
   * whole reason for existing is "an OPTIONAL override on top of `.env`", never a hard
   * dependency) than to turn a DB hiccup into every webhook request suddenly failing. Logged as a
   * warning, never thrown.
   */
  private async getRowSafely(): ReturnType<SystemWebhookConfigRepository["get"]> {
    try {
      return await this.repository.get();
    } catch (caught) {
      this.logger.warn(
        { error: caught instanceof Error ? caught.message : String(caught) },
        "WebhookSecretsService: SystemWebhookConfigRepository.get() failed — falling back to .env for this resolution",
      );
      return undefined;
    }
  }

  async getMetaSecrets(): Promise<WebhookSecretPair> {
    if (this.metaCache !== undefined) {
      return this.metaCache;
    }
    const row = await this.getRowSafely();
    const resolved: WebhookSecretPair = {
      verifyToken: nonEmptyOr(
        row?.meta_webhook_verify_token,
        this.config.META_WEBHOOK_VERIFY_TOKEN,
      ),
      appSecret: nonEmptyOr(row?.meta_webhook_app_secret, this.config.META_WEBHOOK_APP_SECRET),
    };
    this.metaCache = resolved;
    return resolved;
  }

  async getWhatsappSecrets(): Promise<WebhookSecretPair> {
    if (this.whatsappCache !== undefined) {
      return this.whatsappCache;
    }
    const row = await this.getRowSafely();
    const resolved: WebhookSecretPair = {
      verifyToken: nonEmptyOr(
        row?.whatsapp_webhook_verify_token,
        this.config.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
      ),
      appSecret: nonEmptyOr(
        row?.whatsapp_webhook_app_secret,
        this.config.WHATSAPP_WEBHOOK_APP_SECRET,
      ),
    };
    this.whatsappCache = resolved;
    return resolved;
  }

  /** Clears BOTH cached pairs — called by the superadmin webhook-config `PUT` endpoint on every save so a stale cached value never survives past it (same discipline every other settings-write path in this app already follows). */
  invalidate(): void {
    this.metaCache = undefined;
    this.whatsappCache = undefined;
  }
}

function nonEmptyOr(dbValue: string | null | undefined, envDefault: string): string {
  return dbValue !== null && dbValue !== undefined && dbValue.length > 0 ? dbValue : envDefault;
}
