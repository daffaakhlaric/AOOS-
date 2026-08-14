import type { BranchManager } from "@aos/branch-manager";
import { BranchManagerFactory } from "@aos/branch-manager";
import { EventBroker, type IPublisher } from "@aos/event-bus";
import {
  ClosingRepository,
  createSupabaseClient,
  LeadStoreFactory,
  MessageRepository,
  type LeadStore,
} from "@aos/lead-store";
import { MetaAdsConnectorFactory, type MetaAdsConnector } from "@aos/meta-ads-connector";
import type { ObjectiveEngine } from "@aos/objective-engine";
import { ObjectiveEngineFactory } from "@aos/objective-engine";
import { WhatsAppConnectorFactory, type WhatsAppConnector } from "@aos/whatsapp-connector";
import type { DynamicModule } from "@nestjs/common";
import { Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";

import type { AaosApiConfig } from "./config/aaos-api.config.js";
import { toBranchManagerConfig } from "./config/to-branch-manager-config.js";
import { toConnectorConfig } from "./config/to-connector-config.js";
import { toLeadStoreConfig } from "./config/to-lead-store-config.js";
import { toObjectiveEngineConfig } from "./config/to-objective-engine-config.js";
import { toWhatsAppConnectorConfig } from "./config/to-whatsapp-connector-config.js";
import {
  AAOS_API_CONFIG,
  BRANCH_MANAGER,
  EVENT_PUBLISHER,
  LEAD_STORE,
  LEAD_STORE_CLOSING_REPOSITORY,
  LEAD_STORE_MESSAGE_REPOSITORY,
  META_ADS_CONNECTOR,
  OBJECTIVE_ENGINE,
  WHATSAPP_CONNECTOR,
} from "./di-tokens.js";
import { AaosExceptionFilter } from "./filters/aaos-exception.filter.js";
import { LoggingInterceptor } from "./interceptors/logging.interceptor.js";
import { TracingInterceptor } from "./interceptors/tracing.interceptor.js";
import { BranchesModule } from "./modules/branches/branches.module.js";
import { CampaignsModule } from "./modules/campaigns/campaigns.module.js";
import { ClosingsModule } from "./modules/closings/closings.module.js";
import { CreativePackagesModule } from "./modules/creative-packages/creative-packages.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { LeadsModule } from "./modules/leads/leads.module.js";
import { LlmModule } from "./modules/llm/llm.module.js";
import { MetaAdsModule } from "./modules/meta-ads/meta-ads.module.js";
import { ObjectiveModule } from "./modules/objective/objective.module.js";
import { SalesModule } from "./modules/sales/sales.module.js";
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

    return {
      module: AppModule,
      global: true,
      imports: [
        HealthModule,
        LeadsModule,
        LlmModule,
        MetaAdsModule,
        WebhookModule,
        WhatsAppWebhookModule,
        ObjectiveModule,
        CreativePackagesModule,
        BranchesModule,
        CampaignsModule,
        ClosingsModule,
        SalesModule,
      ],
      providers: [
        { provide: AAOS_API_CONFIG, useValue: config },
        { provide: EVENT_PUBLISHER, useValue: publisher },
        { provide: META_ADS_CONNECTOR, useValue: connector },
        { provide: WHATSAPP_CONNECTOR, useValue: whatsAppConnector },
        { provide: LEAD_STORE, useValue: leadStore },
        { provide: OBJECTIVE_ENGINE, useValue: objectiveEngine },
        { provide: BRANCH_MANAGER, useValue: branchManager },
        { provide: LEAD_STORE_MESSAGE_REPOSITORY, useValue: messageRepository },
        { provide: LEAD_STORE_CLOSING_REPOSITORY, useValue: closingRepository },
        { provide: APP_FILTER, useValue: new AaosExceptionFilter() },
        { provide: APP_INTERCEPTOR, useValue: new LoggingInterceptor() },
        { provide: APP_INTERCEPTOR, useValue: new TracingInterceptor() },
      ],
      exports: [
        AAOS_API_CONFIG,
        EVENT_PUBLISHER,
        META_ADS_CONNECTOR,
        WHATSAPP_CONNECTOR,
        LEAD_STORE,
        OBJECTIVE_ENGINE,
        BRANCH_MANAGER,
        LEAD_STORE_MESSAGE_REPOSITORY,
        LEAD_STORE_CLOSING_REPOSITORY,
      ],
    };
  }
}
