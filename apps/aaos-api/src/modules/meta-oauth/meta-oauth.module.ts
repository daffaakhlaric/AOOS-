import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { EncryptionService } from "../../common/encryption.service.js";
import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import { AAOS_API_CONFIG, SUPABASE_CLIENT } from "../../di-tokens.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { MetaOAuthConfigService } from "../meta-oauth-config/meta-oauth-config.service.js";
import { WabaConfigRepository } from "../settings/infrastructure/waba-config.repository.js";
import { SystemMetaOAuthConfigRepository } from "../superadmin/infrastructure/system-meta-oauth-config.repository.js";
import { TenantRepository } from "../superadmin/infrastructure/tenant.repository.js";

import { OAuthStateRepository } from "./infrastructure/oauth-state.repository.js";
import { TokenRefreshLogRepository } from "./infrastructure/token-refresh-log.repository.js";
import { MetaOAuthRefreshCronService } from "./meta-oauth-refresh-cron.service.js";
import { MetaOAuthController } from "./meta-oauth.controller.js";
import { MetaOAuthService } from "./meta-oauth.service.js";
import { WaOAuthService } from "./wa-oauth.service.js";

/**
 * `modules/meta-oauth` (Sprint 2 — EYVRA-META-OAUTH-WHATSAPP-SETUP). Every repository/service is
 * built from the shared `SUPABASE_CLIENT`/`AAOS_API_CONFIG` global tokens `AppModule.forRoot`
 * already exports — same "each module composes its own instance of a shared repository class over
 * one shared connection" pattern `SettingsModule`/`SosmedModule` already establish, never a second
 * Supabase connection.
 *
 * `EncryptionService`/`MetaOAuthConfigService` (Sprint 1's foundation, unwired until now) are
 * composed here via `useFactory` rather than plain-`new`-composed in `app.module.ts`'s composition
 * root: neither is a cross-cutting dependency of anything OUTSIDE this module today (unlike
 * `WebhookSecretsService`, which both connector registries — plain-JS-composed before Nest's DI
 * container exists — also need), so keeping them module-local avoids widening `app.module.ts`'s
 * already-large composition root for a dependency only this module currently uses.
 */
@Module({
  controllers: [MetaOAuthController],
  providers: [
    ApiKeyGuard,
    MetaOAuthService,
    WaOAuthService,
    MetaOAuthRefreshCronService,
    {
      provide: TenantRepository,
      useFactory: (client: SupabaseClientLike): TenantRepository => new TenantRepository(client),
      inject: [SUPABASE_CLIENT],
    },
    {
      provide: WabaConfigRepository,
      useFactory: (client: SupabaseClientLike): WabaConfigRepository =>
        new WabaConfigRepository(client),
      inject: [SUPABASE_CLIENT],
    },
    {
      provide: OAuthStateRepository,
      useFactory: (client: SupabaseClientLike): OAuthStateRepository =>
        new OAuthStateRepository(client),
      inject: [SUPABASE_CLIENT],
    },
    {
      provide: TokenRefreshLogRepository,
      useFactory: (client: SupabaseClientLike): TokenRefreshLogRepository =>
        new TokenRefreshLogRepository(client),
      inject: [SUPABASE_CLIENT],
    },
    {
      provide: SystemMetaOAuthConfigRepository,
      useFactory: (client: SupabaseClientLike): SystemMetaOAuthConfigRepository =>
        new SystemMetaOAuthConfigRepository(client),
      inject: [SUPABASE_CLIENT],
    },
    {
      provide: EncryptionService,
      useFactory: (config: AaosApiConfig): EncryptionService => new EncryptionService(config),
      inject: [AAOS_API_CONFIG],
    },
    {
      provide: MetaOAuthConfigService,
      useFactory: (
        repository: SystemMetaOAuthConfigRepository,
        encryption: EncryptionService,
        config: AaosApiConfig,
      ): MetaOAuthConfigService => new MetaOAuthConfigService(repository, encryption, config),
      inject: [SystemMetaOAuthConfigRepository, EncryptionService, AAOS_API_CONFIG],
    },
  ],
  exports: [MetaOAuthService, WaOAuthService],
})
export class MetaOAuthModule {}
