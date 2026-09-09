import { createLogger, type Logger } from "@aos/logger";
import { Inject, Injectable } from "@nestjs/common";

import type { EncryptionService } from "../../common/encryption.service.js";
import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import { AAOS_API_CONFIG } from "../../di-tokens.js";
import type { SystemMetaOAuthConfigRepository } from "../superadmin/infrastructure/system-meta-oauth-config.repository.js";

export interface MetaAppConfig {
  readonly appId: string;
  /** Always the DECRYPTED plaintext secret — never the DB's `meta_app_secret_encrypted` envelope. */
  readonly appSecret: string;
  readonly waConfigId: string;
}

/**
 * `modules/meta-oauth-config` — EYVRA-META-OAUTH-WHATSAPP-SETUP (Sprint 1 — Foundation). Real,
 * DB-first/`.env`-fallback resolver for the GLOBAL Meta App OAuth credentials
 * (`system_meta_oauth_config`, one row, superadmin-editable), mirroring `WebhookSecretsService`'s
 * shape and caching discipline exactly — see that class's own doc for the full rationale
 * (deliberately a SMALL, STANDALONE module for the same circular-import-avoidance reason,
 * composed once as a real singleton wherever `app.module.ts`'s `forRoot` needs it, not hosted
 * inside `SuperadminModule` even though `SystemMetaOAuthConfigRepository` itself lives under
 * `superadmin/infrastructure/`).
 *
 * ONE real difference from `WebhookSecretsService`: `meta_app_secret_encrypted` is
 * `EncryptionService`-encrypted at rest, so `getMetaAppConfig()` decrypts it on the way out. A
 * `SystemMetaOAuthConfigRepository.get()` failure (network hiccup, table not yet migrated) is
 * caught and logged, falling back to `.env` — same "must never turn a transient config-table read
 * failure into a hard failure" discipline `WebhookSecretsService.getRowSafely` already
 * establishes. A DECRYPT failure (tampered/corrupted ciphertext, or `TOKEN_ENCRYPTION_KEY`
 * rotated without re-encrypting stored rows) is DELIBERATELY NOT swallowed — that is a real data-
 * integrity problem a silent `.env` fallback could quietly mask with a stale or wrong secret, so
 * it propagates as a thrown `EncryptionServiceError` instead.
 *
 * NOT wired into `app.module.ts`/any controller in THIS sprint — no real consumer exists yet (the
 * OAuth controller itself is a later sprint's job). This class and its repository exist now purely
 * as the foundation that sprint will compose against, matching the dispatch's explicit "foundation
 * only, no wiring" scope.
 */
@Injectable()
export class MetaOAuthConfigService {
  private cache: MetaAppConfig | undefined;
  private readonly logger: Logger;

  constructor(
    private readonly repository: SystemMetaOAuthConfigRepository,
    private readonly encryption: EncryptionService,
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    logger?: Logger,
  ) {
    this.logger = logger ?? createLogger({ serviceName: "meta-oauth-config-service" });
  }

  private async getRowSafely(): ReturnType<SystemMetaOAuthConfigRepository["get"]> {
    try {
      return await this.repository.get();
    } catch (caught) {
      this.logger.warn(
        { error: caught instanceof Error ? caught.message : String(caught) },
        "MetaOAuthConfigService: SystemMetaOAuthConfigRepository.get() failed — falling back to .env for this resolution",
      );
      return undefined;
    }
  }

  async getMetaAppConfig(): Promise<MetaAppConfig> {
    if (this.cache !== undefined) {
      return this.cache;
    }
    const row = await this.getRowSafely();

    const appSecret =
      row?.meta_app_secret_encrypted !== null &&
      row?.meta_app_secret_encrypted !== undefined &&
      row.meta_app_secret_encrypted.length > 0
        ? this.encryption.decrypt(row.meta_app_secret_encrypted)
        : this.config.META_APP_SECRET;

    const resolved: MetaAppConfig = {
      appId: nonEmptyOr(row?.meta_app_id, this.config.META_APP_ID),
      appSecret,
      waConfigId: nonEmptyOr(row?.wa_config_id, this.config.WA_CONFIG_ID),
    };
    this.cache = resolved;
    return resolved;
  }

  /** Clears the cached config — a future superadmin `PUT` endpoint calls this on every save, same discipline `WebhookSecretsService.invalidate()` already establishes. */
  invalidate(): void {
    this.cache = undefined;
  }
}

function nonEmptyOr(dbValue: string | null | undefined, envDefault: string): string {
  return dbValue !== null && dbValue !== undefined && dbValue.length > 0 ? dbValue : envDefault;
}
