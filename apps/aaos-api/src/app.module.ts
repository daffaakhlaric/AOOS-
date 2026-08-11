import { EventBroker, type IPublisher } from "@aos/event-bus";
import { LeadStoreFactory, type LeadStore } from "@aos/lead-store";
import { MetaAdsConnectorFactory, type MetaAdsConnector } from "@aos/meta-ads-connector";
import { WhatsAppConnectorFactory, type WhatsAppConnector } from "@aos/whatsapp-connector";
import type { DynamicModule } from "@nestjs/common";
import { Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";

import type { AaosApiConfig } from "./config/aaos-api.config.js";
import { toConnectorConfig } from "./config/to-connector-config.js";
import { toLeadStoreConfig } from "./config/to-lead-store-config.js";
import { toWhatsAppConnectorConfig } from "./config/to-whatsapp-connector-config.js";
import {
  AAOS_API_CONFIG,
  EVENT_PUBLISHER,
  LEAD_STORE,
  META_ADS_CONNECTOR,
  WHATSAPP_CONNECTOR,
} from "./di-tokens.js";
import { AaosExceptionFilter } from "./filters/aaos-exception.filter.js";
import { LoggingInterceptor } from "./interceptors/logging.interceptor.js";
import { TracingInterceptor } from "./interceptors/tracing.interceptor.js";
import { HealthModule } from "./modules/health/health.module.js";
import { LeadsModule } from "./modules/leads/leads.module.js";
import { MetaAdsModule } from "./modules/meta-ads/meta-ads.module.js";
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
    const leadStore: LeadStore = LeadStoreFactory.create({
      config: leadStoreConfigResult.value,
      publisher,
    });

    return {
      module: AppModule,
      global: true,
      imports: [HealthModule, LeadsModule, MetaAdsModule, WebhookModule, WhatsAppWebhookModule],
      providers: [
        { provide: AAOS_API_CONFIG, useValue: config },
        { provide: EVENT_PUBLISHER, useValue: publisher },
        { provide: META_ADS_CONNECTOR, useValue: connector },
        { provide: WHATSAPP_CONNECTOR, useValue: whatsAppConnector },
        { provide: LEAD_STORE, useValue: leadStore },
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
      ],
    };
  }
}
