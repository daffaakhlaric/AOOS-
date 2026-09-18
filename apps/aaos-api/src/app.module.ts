import { AssetLibraryFactory, type AssetLibrary } from "@aos/asset-library";
import type { BranchManager } from "@aos/branch-manager";
import { BranchManagerFactory } from "@aos/branch-manager";
import { CapiConnectorFactory, type CapiConnector } from "@aos/capi-connector";
import { KaiAgentFactory, type KaiAgentRuntime } from "@aos/creative-agent";
import { CreativeConnectorFactory } from "@aos/creative-connector";
import { EventBroker, type IEventBroker, type IPublisher } from "@aos/event-bus";
import {
  ClosingRepository,
  createSupabaseClient,
  LeadRepository,
  LeadStoreFactory,
  MessageRepository,
  ScoringRepository,
  type LeadStore,
} from "@aos/lead-store";
import { MetaAdsConnectorFactory, type MetaAdsConnector } from "@aos/meta-ads-connector";
import { MobixScraperFactory, type MobixScraperService } from "@aos/mobix-web-scraper";
import type { ObjectiveEngine } from "@aos/objective-engine";
import { ObjectiveEngineFactory } from "@aos/objective-engine";
import { WhatsAppConnectorFactory, type WhatsAppConnector } from "@aos/whatsapp-connector";
import type { DynamicModule } from "@nestjs/common";
import { Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { createClient } from "@supabase/supabase-js";

import { EncryptionService } from "./common/encryption.service.js";
import type { AaosApiConfig } from "./config/aaos-api.config.js";
import {
  isAssetLibraryConfigured,
  toAssetLibraryConfig,
} from "./config/to-asset-library-config.js";
import { toBranchManagerConfig } from "./config/to-branch-manager-config.js";
import {
  isCapiConnectorConfigured,
  toCapiConnectorConfig,
} from "./config/to-capi-connector-config.js";
import { toConnectorConfig } from "./config/to-connector-config.js";
import {
  isCreativePipelineConfigured,
  toCreativeConnectorConfig,
} from "./config/to-creative-connector-config.js";
import { toLeadStoreConfig } from "./config/to-lead-store-config.js";
import { toObjectiveEngineConfig } from "./config/to-objective-engine-config.js";
import { toWhatsAppConnectorConfig } from "./config/to-whatsapp-connector-config.js";
import {
  AAOS_API_CONFIG,
  ASSET_LIBRARY,
  BRANCH_MANAGER,
  CAPI_CONNECTOR,
  EVENT_BROKER,
  EVENT_PUBLISHER,
  KAI_AGENT_RUNTIME,
  LEAD_STORE,
  LEAD_STORE_CLOSING_REPOSITORY,
  LEAD_STORE_LEAD_REPOSITORY,
  LEAD_STORE_MESSAGE_REPOSITORY,
  LEAD_STORE_SCORING_REPOSITORY,
  META_ADS_CONNECTOR,
  META_ADS_CONNECTOR_REGISTRY,
  MOBIX_SCRAPER_SERVICE,
  OBJECTIVE_ENGINE,
  SUPABASE_AUTH_ADMIN,
  SUPABASE_CLIENT,
  WEBHOOK_SECRETS_SERVICE,
  WHATSAPP_CONNECTOR,
  WHATSAPP_CONNECTOR_REGISTRY,
} from "./di-tokens.js";
import { AaosExceptionFilter } from "./filters/aaos-exception.filter.js";
import { LoggingInterceptor } from "./interceptors/logging.interceptor.js";
import { TracingInterceptor } from "./interceptors/tracing.interceptor.js";
import { AbTestingModule } from "./modules/abtesting/abtesting.module.js";
import { ActivityLogModule } from "./modules/activity-log/activity-log.module.js";
import { AssetsModule } from "./modules/assets/assets.module.js";
import { AuditLogModule } from "./modules/audit-log/audit-log.module.js";
import { BranchesModule } from "./modules/branches/branches.module.js";
import { CampaignCreationModule } from "./modules/campaign-creation/campaign-creation.module.js";
import { CampaignHealthModule } from "./modules/campaign-health/campaign-health.module.js";
import { CampaignsModule } from "./modules/campaigns/campaigns.module.js";
import { ClosingsModule } from "./modules/closings/closings.module.js";
import { CreativeMemoryModule } from "./modules/creative-memory/creative-memory.module.js";
import { CreativePackagesModule } from "./modules/creative-packages/creative-packages.module.js";
import { GoLiveModule } from "./modules/go-live/go-live.module.js";
import { GrowthObjectivesModule } from "./modules/growth-objectives/growth-objectives.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { HotLeadDefinitionsModule } from "./modules/hot-lead-definitions/hot-lead-definitions.module.js";
import { IntelligenceModule } from "./modules/intelligence/intelligence.module.js";
import { LeadsModule } from "./modules/leads/leads.module.js";
import { ListingsModule } from "./modules/listings/listings.module.js";
import { LlmModule } from "./modules/llm/llm.module.js";
import { LookalikeModule } from "./modules/lookalike/lookalike.module.js";
import { MarketIntelligenceModule } from "./modules/market-intelligence/market-intelligence.module.js";
import { MetaAdsConnectorRegistry } from "./modules/meta-ads/infrastructure/meta-ads-connector-registry.js";
import { MetaAdsModule } from "./modules/meta-ads/meta-ads.module.js";
import { MetaInterestsModule } from "./modules/meta-interests/meta-interests.module.js";
import { MetaOAuthModule } from "./modules/meta-oauth/meta-oauth.module.js";
import { MetricSnapshotModule } from "./modules/metric-snapshot/metric-snapshot.module.js";
import { ObjectiveModule } from "./modules/objective/objective.module.js";
import { OpportunitiesModule } from "./modules/opportunities/opportunities.module.js";
import { OverviewModule } from "./modules/overview/overview.module.js";
import { PropertyObjectiveModule } from "./modules/property-objective/property-objective.module.js";
import { RecyclingModule } from "./modules/recycling/recycling.module.js";
import { RegionModule } from "./modules/region/region.module.js";
import { SalesModule } from "./modules/sales/sales.module.js";
import { SchedulerModule } from "./modules/scheduler/scheduler.module.js";
import { ScraperModule } from "./modules/scraper/scraper.module.js";
import { WabaConfigRepository } from "./modules/settings/infrastructure/waba-config.repository.js";
import { SettingsModule } from "./modules/settings/settings.module.js";
import { SimulationModule } from "./modules/simulation/simulation.module.js";
import { SosmedModule } from "./modules/sosmed/sosmed.module.js";
import { SystemWebhookConfigRepository } from "./modules/superadmin/infrastructure/system-webhook-config.repository.js";
import { TenantRepository } from "./modules/superadmin/infrastructure/tenant.repository.js";
import { SuperadminModule } from "./modules/superadmin/superadmin.module.js";
import { WebhookModule } from "./modules/webhook/webhook.module.js";
import { WebhookSecretsService } from "./modules/webhook-config/webhook-secrets.service.js";
import { WhatsAppConnectorRegistry } from "./modules/whatsapp/infrastructure/whatsapp-connector-registry.js";
import { WhatsAppWebhookModule } from "./modules/whatsapp-webhook/whatsapp-webhook.module.js";

/**
 * Root module. Not statically `@Module({...})`-decorated with fixed providers because this
 * app's composition root needs a fully-validated `AaosApiConfig` value (constructed once, in
 * `main.ts`/the test bootstrap helper, per the "fail fast at the process boundary" guidance) to
 * build the real `@aos/event-bus` `IPublisher` (`new EventBroker()` — the actual event-bus
 * implementation, not a test fake) and the `@aos/meta-ads-connector` `MetaAdsConnector` (via
 * `MetaAdsConnectorFactory.create`). `AppModule.forRoot(config)` is the single composition-root
 * function every entry point (real bootstrap, e2e tests) calls with an already-parsed config.
 *
 * Registered as `global: true` so `AAOS_API_CONFIG`/`EVENT_PUBLISHER`/`META_ADS_CONNECTOR` are
 * injectable from every feature module (`HealthModule`, `MetaAdsModule`, `WebhookModule`)
 * without each of them needing to import `AppModule` back (which would be circular).
 */
@Module({})
export class AppModule {
  static forRoot(config: AaosApiConfig): DynamicModule {
    const connectorConfigResult = toConnectorConfig(config);
    if (!connectorConfigResult.ok) {
      throw connectorConfigResult.error;
    }
    const whatsAppConnectorConfigResult = toWhatsAppConnectorConfig(config);
    if (!whatsAppConnectorConfigResult.ok) {
      throw whatsAppConnectorConfigResult.error;
    }
    const leadStoreConfigResult = toLeadStoreConfig(config);
    if (!leadStoreConfigResult.ok) {
      throw leadStoreConfigResult.error;
    }
    const objectiveEngineConfigResult = toObjectiveEngineConfig(config);
    if (!objectiveEngineConfigResult.ok) {
      throw objectiveEngineConfigResult.error;
    }
    const branchManagerConfigResult = toBranchManagerConfig(config);
    if (!branchManagerConfigResult.ok) {
      throw branchManagerConfigResult.error;
    }

    // Kept as a concrete `EventBroker` (not just `IPublisher`) so its own `.subscriptions` member
    // (a real `SubscriptionManager`, which genuinely `implements ISubscriptionManager`) can be
    // handed to `CapiConnectorFactory` below — `IPublisher`/`IEventBroker` don't declare `.match`/
    // `.count`, so neither type structurally satisfies `ISubscriptionManager` on its own.
    const eventBroker = new EventBroker();
    const publisher: IPublisher = eventBroker;
    const connector: MetaAdsConnector = MetaAdsConnectorFactory.create({
      config: connectorConfigResult.value,
      publisher,
    });
    // Shares the same real `IPublisher` as `MetaAdsConnector` — one event bus for the whole app,
    // per the same composition-root discipline `@aos/meta-ads-connector`'s wiring already
    // establishes.
    const whatsAppConnector: WhatsAppConnector = WhatsAppConnectorFactory.create({
      config: whatsAppConnectorConfigResult.value,
      publisher,
    });
    // AAOS-W4B: the Supabase client is built once here (rather than left to LeadStoreFactory's
    // internal default) so `MessageRepository`/`ClosingRepository` below can share the exact same
    // client/connection `LeadStore`'s own repositories use — one Supabase client for the whole
    // `leads`/`closings`/`messages` schema, not two.
    // AAOS-MULTI-TENANT-PHASE1B (Phase 2) — the real per-tenant WhatsApp connector resolver.
    // Built here (not inside a feature module) because it needs the SAME `whatsAppConnector`/
    // `publisher` this file already composes (the `dss-motor` fallback + shared event bus — see
    // `WhatsAppConnectorRegistry`'s own class doc for why), plus a `WabaConfigRepository` instance
    // over the shared `leadStoreSupabaseClient` (built right below) — mirroring the exact
    // "each consumer composes its own instance of a shared repository class over one shared
    // connection" pattern `SettingsModule`/`RecyclingModule` already establish.
    const leadStoreSupabaseClient = createSupabaseClient(leadStoreConfigResult.value);
    const leadStore: LeadStore = LeadStoreFactory.create({
      config: leadStoreConfigResult.value,
      publisher,
      supabaseClient: leadStoreSupabaseClient,
    });
    // AAOS-W4B additions: real `@aos/lead-store` infra classes, exported from its public
    // `index.ts`, composed here because no `LeadStore` use case exposes "list every message in a
    // conversation" or "list raw closings matching a filter" (see di-tokens.ts's docstring).
    const messageRepository = new MessageRepository(leadStoreSupabaseClient);
    const closingRepository = new ClosingRepository(leadStoreSupabaseClient);
    // AAOS-LEAD-RECYCLING-BROADCAST addition — see di-tokens.ts's `LEAD_STORE_LEAD_REPOSITORY` doc.
    const leadRepository = new LeadRepository(leadStoreSupabaseClient);
    // AAOS-MULTI-TENANT-PHASE1B (Phase 2) — see the import-site comment above and
    // `WhatsAppConnectorRegistry`'s own class doc for the full design rationale (per-tenant
    // resolve/cache, `dss-motor` static fallback, real `Result.err(ConnectorNotConfiguredError)`
    // for an unconfigured tenant).
    const wabaConfigRepository = new WabaConfigRepository(leadStoreSupabaseClient);
    // AAOS-SETTINGS-WEBHOOK-CONFIG (Part C) — the real, DB-first/`.env`-fallback resolver for the
    // GLOBAL Meta/WhatsApp webhook verify-token + app-secret pairs. Composed here, alongside both
    // connector registries, for the SAME reason they are (see `di-tokens.ts`'s
    // `WEBHOOK_SECRETS_SERVICE` doc): one instance, shared by every real consumer, both the
    // Nest-DI-injected ones (guards/webhook services, via the global token below) and these two
    // plain-constructed registries.
    const systemWebhookConfigRepository = new SystemWebhookConfigRepository(
      leadStoreSupabaseClient,
    );
    const webhookSecretsService = new WebhookSecretsService(systemWebhookConfigRepository, config);
    const whatsAppConnectorRegistry = new WhatsAppConnectorRegistry(
      wabaConfigRepository,
      config,
      publisher,
      whatsAppConnector,
      webhookSecretsService,
    );
    // AAOS-MULTI-TENANT-PHASE1B (Phase 3) — the real per-tenant Meta Ads connector resolver, same
    // composition pattern as `whatsAppConnectorRegistry` above: a `TenantRepository` instance over
    // the shared `leadStoreSupabaseClient` (mirrors `SuperadminModule`/`SettingsModule`'s own
    // "each consumer composes its own instance of a shared repository class" precedent), plus the
    // SAME `connector`/`publisher` this file already composes (the `dss-motor` fallback + shared
    // event bus — see `MetaAdsConnectorRegistry`'s own class doc for why).
    const tenantRepository = new TenantRepository(leadStoreSupabaseClient);
    // EYVRA-META-OAUTH-WHATSAPP-SETUP Sprint 3 — real, stateless AES-256-GCM decrypt for a
    // tenant's OAuth-obtained `meta_access_token_encrypted`. Composed here (not reused from
    // `MetaOAuthModule`'s own Nest-DI-provided instance, which is a SEPARATE object — this file's
    // registries are plain-constructed, not Nest-injected) — cheap and side-effect-free
    // (`EncryptionService`'s constructor just parses `TOKEN_ENCRYPTION_KEY`), so a second instance
    // is not a real cost. See `MetaAdsConnectorRegistry`'s own class doc for the additive
    // OAuth-preferring fallback this enables.
    const encryptionService = new EncryptionService(config);
    const metaAdsConnectorRegistry = new MetaAdsConnectorRegistry(
      tenantRepository,
      config,
      publisher,
      connector,
      webhookSecretsService,
      encryptionService,
    );
    // AAOS-CHAT-ROOM-JESSY: `GET /leads/:id/scoring-history`'s thin read over the real
    // `scoring_events` table — same composition pattern as `messageRepository`/`closingRepository`
    // above.
    const scoringRepository = new ScoringRepository(leadStoreSupabaseClient);
    // AAOS-W4A additions: shares the same real `IPublisher` as every other composed package —
    // one event bus for the whole app, per the same discipline established above.
    const objectiveEngine: ObjectiveEngine = ObjectiveEngineFactory.create({
      config: objectiveEngineConfigResult.value,
      publisher,
    });
    const branchManager: BranchManager = BranchManagerFactory.create({
      config: branchManagerConfigResult.value,
      publisher,
    });

    // AAOS-SALES-MGMT-CRM-AUTH: a second, real `@supabase/supabase-js` client over the SAME
    // Supabase project (same URL + service-role key `leadStoreSupabaseClient` above uses), kept
    // untyped-as-`SupabaseClientLike` so `modules/sales`'s `SalesHumansService` can call
    // `.auth.admin.*` (Supabase Auth's Admin API) — see `di-tokens.ts`'s `SUPABASE_AUTH_ADMIN` doc
    // for why this is a separate token rather than widening the shared narrow port.
    const supabaseAuthAdminClient = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // AAOS-SCRAPER-ASSET-LIBRARY: the first real composition of `@aos/asset-library` and
    // `@aos/mobix-web-scraper` in this app.
    //
    // The asset library is composed ONLY when GCS is actually configured — `GcsStorageClient`'s
    // constructor throws (by design) without credentials, so composing unconditionally would take
    // the entire API down on a deployment that hasn't set `GCS_*` yet. When it's absent, the
    // `assets` module's endpoints return an honest "not configured" error and the scraper still
    // runs its listing scrape + `scraped_units` persistence, just without photo ingestion.
    //
    // It builds its own Supabase client from `AssetLibraryConfig` (the package's documented default
    // path) rather than reusing `leadStoreSupabaseClient`: the two packages define their own
    // structurally-distinct `SupabaseClientLike` ports (per Constitution §4.3, no package imports
    // another's internal types), and `@aos/asset-library`'s now requires `ilike`/`range`/count
    // support that `@aos/lead-store`'s port doesn't declare. Same Supabase PROJECT and credentials
    // either way — `@supabase/supabase-js` is a stateless HTTP client, so this is a second client
    // object, not a second database connection.
    let assetLibrary: AssetLibrary | undefined;
    if (isAssetLibraryConfigured(config)) {
      const assetLibraryConfigResult = toAssetLibraryConfig(config);
      if (!assetLibraryConfigResult.ok) {
        throw assetLibraryConfigResult.error;
      }
      assetLibrary = AssetLibraryFactory.create({
        config: assetLibraryConfigResult.value,
        publisher,
      });
    }

    // AAOS-CREATIVE-REVIEW: the FIRST real composition of `@aos/creative-agent` (Kai) and
    // `@aos/creative-connector` (Kie AI) in this app — until now the whole generation pipeline
    // existed at package level and was never imported here.
    //
    // Composed ONLY when a real `KIE_AI_API_KEY` is set AND the asset library exists: `KaiAgentFactory`
    // structurally requires `assetLibrary.getAssetsByUnit` (where Kai finds the unit's real scraped
    // source photos) and `assetLibrary.saveAiCreative` (where the generated video/images are really
    // persisted), so there is no meaningful half-composed state. When either is missing this stays
    // `undefined` and `CreativePackagesService` raises an honest 503 naming the missing env vars.
    //
    // Shares the same real `IPublisher` as every other composed package.
    let kaiRuntime: KaiAgentRuntime | undefined;
    if (assetLibrary !== undefined && isCreativePipelineConfigured(config, true)) {
      const creativeConnectorConfigResult = toCreativeConnectorConfig(config);
      if (!creativeConnectorConfigResult.ok) {
        throw creativeConnectorConfigResult.error;
      }
      const creativeConnector = CreativeConnectorFactory.create({
        config: creativeConnectorConfigResult.value,
        publisher,
      });
      const kaiResult = KaiAgentFactory.create({
        config: { tenantId: config.AAOS_TENANT_ID },
        publisher,
        getAssetsByUnit: assetLibrary.getAssetsByUnit,
        saveAiCreative: assetLibrary.saveAiCreative,
        uploadSourceImage: creativeConnector.uploadSourceImage,
        generateLongVideo: creativeConnector.generateLongVideo,
        generateImageSet: creativeConnector.generateImageSet,
        downloadMedia: creativeConnector.downloadMedia,
      });
      if (!kaiResult.ok) {
        throw kaiResult.error;
      }
      kaiRuntime = kaiResult.value;
    }

    const mobixScraper: MobixScraperService = MobixScraperFactory.create({
      publisher,
      listingUrl: config.MOBIX_LISTING_URL,
      tenantId: config.AAOS_TENANT_ID,
      // Real photo ingestion into GCS — only available when the asset library was composed.
      ...(assetLibrary !== undefined ? { uploadAsset: assetLibrary.uploadAsset } : {}),
      // Durable `scraped_units` persistence against the SAME Supabase project as everything else.
      supabaseUrl: config.SUPABASE_URL,
      supabaseServiceKey: config.SUPABASE_SERVICE_KEY,
    });

    // AAOS-META-MCP-BONUS-TOOLS (Tool 4 — CAPI Health): the FIRST real composition of
    // `@aos/capi-connector` in this app. Composed ONLY when a real `CAPI_PIXEL_ID`/
    // `CAPI_ACCESS_TOKEN` pair is configured — same graceful-degradation discipline as
    // `assetLibrary`/`kaiRuntime` above. See `di-tokens.ts`'s `CAPI_CONNECTOR` doc for why
    // `eventListenerService.start()` is deliberately never called.
    let capiConnector: CapiConnector | undefined;
    if (isCapiConnectorConfigured(config)) {
      const capiConnectorConfigResult = toCapiConnectorConfig(config);
      if (!capiConnectorConfigResult.ok) {
        throw capiConnectorConfigResult.error;
      }
      capiConnector = CapiConnectorFactory.create({
        config: capiConnectorConfigResult.value,
        publisher,
        subscriptionManager: eventBroker.subscriptions,
        getLead: leadStore.getLead,
        closingRepository,
      });
    }

    return {
      module: AppModule,
      global: true,
      imports: [
        // AAOS-KALENDER-AKTIVITAS: registers `@nestjs/schedule`'s cron registry ONCE, at the
        // composition root every feature module (including `SchedulerModule`, the only `@Cron`
        // user today) ultimately sits under.
        ScheduleModule.forRoot(),
        HealthModule,
        LeadsModule,
        LlmModule,
        MetaAdsModule,
        MetaInterestsModule,
        WebhookModule,
        WhatsAppWebhookModule,
        ObjectiveModule,
        // AAOS LOOP UPGRADE, Sprint 6 Prompt 17 — real `api/v1/audit-log*` HTTP surface. Also
        // imported directly by `PendingActionsModule`/`SchedulerModule` for their own real writer
        // call sites (approve/reject, campaign-trigger publish) — this top-level registration is
        // what actually mounts `AuditLogController`'s routes.
        AuditLogModule,
        CreativePackagesModule,
        BranchesModule,
        CampaignsModule,
        ClosingsModule,
        SalesModule,
        SimulationModule,
        // AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 4 — Go Live execution/rollback, built on top
        // of SimulationModule's `simulations`/`simulation_logs` tables and SettingsModule's
        // `waba_configs` (see GoLiveModule's own doc for why it composes its own repository
        // instances rather than importing those modules).
        GoLiveModule,
        SchedulerModule,
        ScraperModule,
        AssetsModule,
        // AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 1 — SuperadminModule imported before
        // SettingsModule so its exported TenantRepository provider (not actually consumed
        // cross-module today, both modules build their own instance from SUPABASE_CLIENT — see
        // each module's own doc) resolves without ordering surprises.
        SuperadminModule,
        SettingsModule,
        // AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 2 — Listing Manager (PROPERTY vertical's
        // `listings` CRUD + photo upload, replacing Scraper Mobix for that vertical).
        ListingsModule,
        // AAOS-LEAD-RECYCLING-BROADCAST — new `recycling` module (pool/templates/broadcast/logs
        // endpoints + the RECYCLING_RUN Kalender handler's business logic + the reply-detection
        // hook). `SchedulerModule` separately imports this module directly (Nest resolves that
        // import independently of array order here) so it can inject the exported
        // `RecyclingService` for its own `RECYCLING_RUN` handler.
        RecyclingModule,
        // AAOS-ABTESTING-LOOKALIKE Part 1 — new `abtesting` module (A/B test CRUD endpoints + the
        // AB_TEST_CHECK Kalender handler's business logic). `SchedulerModule` separately imports
        // this module directly (same pattern as `RecyclingModule`) so it can inject the exported
        // `AbTestingService` for its own `AB_TEST_CHECK` handler.
        AbTestingModule,
        // AAOS-ABTESTING-LOOKALIKE Part 2 — new `lookalike` module (Custom/Lookalike Audience
        // endpoints + the LOOKALIKE_SYNC Kalender handler's business logic). `SchedulerModule`
        // separately imports this module directly (same pattern as `AbTestingModule`) so it can
        // inject the exported `LookalikeService` for its own `LOOKALIKE_SYNC` handler.
        LookalikeModule,
        // AAOS-SOSMED-AUTOMATION Phase 1 — new `sosmed` module (caption/hashtag generation
        // endpoints only, per the coordinator note's risk-ordered build plan). No Kalender/
        // scheduler wiring yet — `SchedulerModule` does not import this module in this phase.
        SosmedModule,
        // AAOS-SAMANTHA-INTELLIGENCE-LAYER Phase 4 — new `intelligence` module (signals/refresh +
        // competitor_pages CRUD endpoints + the SAMANTHA_INTELLIGENCE_REFRESH Kalender handler's
        // business logic + the Daily Digest extension). `SchedulerModule` separately imports this
        // module directly (same pattern as `RecyclingModule`/`AbTestingModule`/`LookalikeModule`)
        // so it can inject the exported `IntelligenceService`.
        IntelligenceModule,
        // AAOS LOOP UPGRADE, Sprint 7 Prompt 18 — new `market-intelligence` module (`GET/POST
        // /api/v1/market-signals/*` + the MARKET_INTELLIGENCE_REFRESH Kalender handler's business
        // logic). `SchedulerModule` separately imports this module directly (same pattern as
        // `IntelligenceModule`) so it can inject the exported `MarketIntelligenceService`, and
        // `IntelligenceModule`'s own `LlmModule` import already threads the resulting
        // `MarketSignals` into `LlmService.campaignStrategy`'s real context.
        MarketIntelligenceModule,
        // AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase B — new `activity-log` module (`GET
        // /api/v1/activity-log` + the exported `ActivityLogger`, which `MetaAdsModule`/
        // `CampaignsModule` each import directly to log their own gated actions — same
        // "each real consumer imports the small standalone module directly" pattern
        // `ModeGuardModule` already establishes).
        ActivityLogModule,
        // AAOS Overview Monitor Phase O1 — new `overview` module: one real aggregate
        // `GET /api/v1/overview` composing 3 genuinely new real reads (judge-score-today,
        // recycling-today, the daily LLM insight) with the already-real sources Finding 4
        // identified (leads/campaigns/objective/activity-log/heatmap), all reused in-process via
        // each of their own module's newly-exported service (see `OverviewModule`'s own doc).
        OverviewModule,
        // Phase O1 — new `property-objective` module: a genuinely separate PROPERTY-tenant
        // equivalent of ObjectiveModule (see that module's own doc for why this is NOT a
        // generalization of `packages/objective-engine`'s AUTOMOTIVE-specific domain model).
        // Additive — ObjectiveModule itself is untouched.
        PropertyObjectiveModule,
        // AAOS-GEO-TARGETING-AND-REGION-PICKER Part B — new `region` module, a real read-only
        // proxy over the public wilayah (province/kabupaten/kecamatan) catalog backing the
        // Listing form's cascading picker. No new global provider — `RegionService` composes its
        // own in-memory cache and calls the public API directly, no `SUPABASE_CLIENT` involved.
        RegionModule,
        // EYVRA-META-OAUTH-WHATSAPP-SETUP Sprint 2 — new `meta-oauth` module (`/oauth/*`: real
        // Meta Ads Facebook Login OAuth + WhatsApp Embedded Signup/manual setup). Builds its own
        // `TenantRepository`/`WabaConfigRepository`/`EncryptionService`/`MetaOAuthConfigService`
        // instances from the shared `SUPABASE_CLIENT`/`AAOS_API_CONFIG` global tokens (see that
        // module's own doc) — does NOT modify `MetaAdsConnectorRegistry`/`WhatsAppConnectorRegistry`
        // above, or read/write any column either of them reads; wiring those registries to the new
        // OAuth columns is explicitly Sprint 3's job.
        MetaOAuthModule,
        // EYVRA -- SAMANTHA V2 Phase 1 Part A -- Growth Objective domain + tenant-level Hot Lead
        // Definition config. Neither module touches `@aos/lead-store`, `@aos/meta-ads-connector`,
        // or any Kai/creative-connector code (out of scope for this phase) -- both build their own
        // repository instance from the shared `SUPABASE_CLIENT`, same pattern `ListingsModule`
        // establishes.
        GrowthObjectivesModule,
        HotLeadDefinitionsModule,
        // EYVRA -- SAMANTHA V2 Phase 1 Part B (first half) -- Metric Snapshot domain: real windowed
        // aggregates + data sufficiency + benchmark over `meta_insights_daily`. Builds its own
        // repository instance from the shared `SUPABASE_CLIENT`, same pattern the two modules above
        // establish. Does not touch `meta-sync`/`meta-ads` -- reads the same real table those
        // modules already write, nothing more.
        MetricSnapshotModule,
        // EYVRA -- SAMANTHA V2 + KAI V2 Phase 2 -- Creative Performance Memory: real, read-only
        // `GET /api/v1/creative-memory/angle-performance` joining `creative_packages
        // .published_meta_ad_ids` through `meta_ads`/`meta_insights_daily`. Builds its own
        // repository instance from the shared `SUPABASE_CLIENT`, same pattern `MetricSnapshotModule`
        // establishes -- deliberately does NOT import `CreativePackagesModule` (see
        // `creative-memory.module.ts`'s own doc for why). Never writes to any of the three tables it
        // reads and never touches the real KIE.ai generation pipeline.
        CreativeMemoryModule,
        // EYVRA -- SAMANTHA V2 Phase 3 -- Campaign Health: real, read-only
        // `GET /api/v1/campaign-health/:campaignId`, a 7-dimension deterministic health assessment
        // + root-cause diagnosis over MetricSnapshotService's already-shipped snapshots/signals/
        // benchmark. Zero I/O of its own -- imports MetricSnapshotModule to reuse its exported
        // MetricSnapshotService rather than composing a new repository, unlike every module above.
        // Never calls LlmService.campaignInsight (see campaign-health/domain/diagnosis.ts's own doc
        // for why that wiring is explicitly out of scope for this phase).
        CampaignHealthModule,
        // EYVRA -- SAMANTHA V2 Phase 9 -- Opportunity Engine: real, read-only
        // `GET /api/v1/opportunities/:campaignId`, surfacing positive findings (SCALING_OPPORTUNITY,
        // CREATIVE_WINNER_EXPANSION) derived purely from CampaignHealthService.assess +
        // CreativeMemoryService.getAnglePerformance. Zero I/O/repository of its own -- imports
        // CampaignHealthModule/CreativeMemoryModule to reuse their exported services, same pattern
        // CampaignHealthModule itself establishes for MetricSnapshotModule.
        OpportunitiesModule,
        // EYVRA -- SAMANTHA V2 + KAI V2 Phase 25 -- Autonomous Campaign Creation foundation (PROMPT
        // 32/33/35): real, read-only Listing Readiness / Campaign Blueprint / Campaign Preflight --
        // deterministic planning/assessment only, zero Meta API call, zero mutation (see
        // campaign-creation/domain/campaign-blueprint.ts's own doc). Imports ListingsModule/
        // GrowthObjectivesModule to reuse their exported ListingsService/GrowthObjectivesService,
        // same "reuse the real service, never a parallel repository" pattern CampaignHealthModule/
        // OpportunitiesModule already establish above. PROMPT 36 (the real Meta-mutating campaign
        // creation) is explicitly out of scope for this phase.
        CampaignCreationModule,
      ],
      providers: [
        { provide: AAOS_API_CONFIG, useValue: config },
        { provide: EVENT_PUBLISHER, useValue: publisher },
        // Same real `EventBroker` instance as `EVENT_PUBLISHER` above, exposed under its full
        // `IEventBroker` interface — see di-tokens.ts's doc. `publisher` is always a real
        // `EventBroker` (constructed a few lines above), so this cast reaches for a capability
        // (`.subscribe`) the object genuinely has, never a fake widening.
        { provide: EVENT_BROKER, useValue: publisher as IEventBroker },
        { provide: META_ADS_CONNECTOR, useValue: connector },
        { provide: META_ADS_CONNECTOR_REGISTRY, useValue: metaAdsConnectorRegistry },
        { provide: WHATSAPP_CONNECTOR, useValue: whatsAppConnector },
        { provide: WHATSAPP_CONNECTOR_REGISTRY, useValue: whatsAppConnectorRegistry },
        { provide: WEBHOOK_SECRETS_SERVICE, useValue: webhookSecretsService },
        { provide: LEAD_STORE, useValue: leadStore },
        { provide: OBJECTIVE_ENGINE, useValue: objectiveEngine },
        { provide: BRANCH_MANAGER, useValue: branchManager },
        { provide: LEAD_STORE_MESSAGE_REPOSITORY, useValue: messageRepository },
        { provide: LEAD_STORE_CLOSING_REPOSITORY, useValue: closingRepository },
        { provide: LEAD_STORE_SCORING_REPOSITORY, useValue: scoringRepository },
        { provide: LEAD_STORE_LEAD_REPOSITORY, useValue: leadRepository },
        { provide: SUPABASE_CLIENT, useValue: leadStoreSupabaseClient },
        { provide: SUPABASE_AUTH_ADMIN, useValue: supabaseAuthAdminClient },
        // `useValue: undefined` is intentional and load-bearing: it makes `ASSET_LIBRARY` an
        // injectable token that resolves to `undefined` on a GCS-less deployment, rather than a
        // missing provider that would fail Nest's dependency resolution at boot.
        { provide: ASSET_LIBRARY, useValue: assetLibrary },
        { provide: MOBIX_SCRAPER_SERVICE, useValue: mobixScraper },
        // `useValue: undefined` is intentional and load-bearing, same rationale as `ASSET_LIBRARY`
        // above — an injectable token that resolves to `undefined` on a deployment with no Kie AI
        // key, rather than a missing provider that would fail Nest's resolution at boot.
        { provide: KAI_AGENT_RUNTIME, useValue: kaiRuntime },
        // `useValue: undefined` is intentional and load-bearing, same rationale as `ASSET_LIBRARY`/
        // `KAI_AGENT_RUNTIME` above — an injectable token that resolves to `undefined` on a
        // deployment with no CAPI pixel/token configured, rather than a missing provider that
        // would fail Nest's resolution at boot.
        { provide: CAPI_CONNECTOR, useValue: capiConnector },
        { provide: APP_FILTER, useValue: new AaosExceptionFilter() },
        { provide: APP_INTERCEPTOR, useValue: new LoggingInterceptor() },
        { provide: APP_INTERCEPTOR, useValue: new TracingInterceptor() },
      ],
      exports: [
        AAOS_API_CONFIG,
        EVENT_PUBLISHER,
        EVENT_BROKER,
        META_ADS_CONNECTOR,
        META_ADS_CONNECTOR_REGISTRY,
        WHATSAPP_CONNECTOR,
        WHATSAPP_CONNECTOR_REGISTRY,
        WEBHOOK_SECRETS_SERVICE,
        LEAD_STORE,
        OBJECTIVE_ENGINE,
        BRANCH_MANAGER,
        LEAD_STORE_MESSAGE_REPOSITORY,
        LEAD_STORE_CLOSING_REPOSITORY,
        LEAD_STORE_SCORING_REPOSITORY,
        LEAD_STORE_LEAD_REPOSITORY,
        SUPABASE_CLIENT,
        SUPABASE_AUTH_ADMIN,
        ASSET_LIBRARY,
        MOBIX_SCRAPER_SERVICE,
        KAI_AGENT_RUNTIME,
        CAPI_CONNECTOR,
      ],
    };
  }
}
