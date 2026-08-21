import { AssetLibraryFactory, type AssetLibrary } from "@aos/asset-library";
import type { BranchManager } from "@aos/branch-manager";
import { BranchManagerFactory } from "@aos/branch-manager";
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

import type { AaosApiConfig } from "./config/aaos-api.config.js";
import {
  isAssetLibraryConfigured,
  toAssetLibraryConfig,
} from "./config/to-asset-library-config.js";
import { toBranchManagerConfig } from "./config/to-branch-manager-config.js";
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
  EVENT_BROKER,
  EVENT_PUBLISHER,
  KAI_AGENT_RUNTIME,
  LEAD_STORE,
  LEAD_STORE_CLOSING_REPOSITORY,
  LEAD_STORE_LEAD_REPOSITORY,
  LEAD_STORE_MESSAGE_REPOSITORY,
  LEAD_STORE_SCORING_REPOSITORY,
  META_ADS_CONNECTOR,
  MOBIX_SCRAPER_SERVICE,
  OBJECTIVE_ENGINE,
  SUPABASE_AUTH_ADMIN,
  SUPABASE_CLIENT,
  WHATSAPP_CONNECTOR,
} from "./di-tokens.js";
import { AaosExceptionFilter } from "./filters/aaos-exception.filter.js";
import { LoggingInterceptor } from "./interceptors/logging.interceptor.js";
import { TracingInterceptor } from "./interceptors/tracing.interceptor.js";
import { AssetsModule } from "./modules/assets/assets.module.js";
import { BranchesModule } from "./modules/branches/branches.module.js";
import { CampaignsModule } from "./modules/campaigns/campaigns.module.js";
import { ClosingsModule } from "./modules/closings/closings.module.js";
import { CreativePackagesModule } from "./modules/creative-packages/creative-packages.module.js";
import { GoLiveModule } from "./modules/go-live/go-live.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { LeadsModule } from "./modules/leads/leads.module.js";
import { ListingsModule } from "./modules/listings/listings.module.js";
import { LlmModule } from "./modules/llm/llm.module.js";
import { MetaAdsModule } from "./modules/meta-ads/meta-ads.module.js";
import { MetaInterestsModule } from "./modules/meta-interests/meta-interests.module.js";
import { ObjectiveModule } from "./modules/objective/objective.module.js";
import { RecyclingModule } from "./modules/recycling/recycling.module.js";
import { SalesModule } from "./modules/sales/sales.module.js";
import { SchedulerModule } from "./modules/scheduler/scheduler.module.js";
import { ScraperModule } from "./modules/scraper/scraper.module.js";
import { SettingsModule } from "./modules/settings/settings.module.js";
import { SimulationModule } from "./modules/simulation/simulation.module.js";
import { SuperadminModule } from "./modules/superadmin/superadmin.module.js";
import { WebhookModule } from "./modules/webhook/webhook.module.js";
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

    const publisher: IPublisher = new EventBroker();
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
        { provide: WHATSAPP_CONNECTOR, useValue: whatsAppConnector },
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
        { provide: APP_FILTER, useValue: new AaosExceptionFilter() },
        { provide: APP_INTERCEPTOR, useValue: new LoggingInterceptor() },
        { provide: APP_INTERCEPTOR, useValue: new TracingInterceptor() },
      ],
      exports: [
        AAOS_API_CONFIG,
        EVENT_PUBLISHER,
        EVENT_BROKER,
        META_ADS_CONNECTOR,
        WHATSAPP_CONNECTOR,
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
      ],
    };
  }
}
