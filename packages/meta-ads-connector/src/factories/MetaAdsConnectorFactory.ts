import { err, ok } from "@aos/common";
import { ValidationError } from "@aos/errors";
import type { IPublisher } from "@aos/event-bus";
import { createLogger, type Logger } from "@aos/logger";
import { getTracer } from "@aos/telemetry";

import { MetaAdsSyncService } from "../application/services/MetaAdsSyncService.js";
import { VerdictExecutionService } from "../application/services/VerdictExecutionService.js";
import { ExecuteVerdict } from "../application/use-cases/ExecuteVerdict.js";
import { ProcessLeadWebhook } from "../application/use-cases/ProcessLeadWebhook.js";
import { PullCampaignData, type Tracer } from "../application/use-cases/PullCampaignData.js";
import type { MetaAdsConnectorConfig } from "../config/MetaAdsConnectorConfig.js";
import { MetaAdsConnectorEvents } from "../domain/events/MetaAdsConnectorEvents.js";
import { MetaApiClient } from "../infrastructure/meta-api/MetaApiClient.js";
import { TokenBucketRateLimiter } from "../infrastructure/rate-limiter/TokenBucketRateLimiter.js";
import { ExponentialBackoffRetry } from "../infrastructure/retry/ExponentialBackoffRetry.js";
import { WebhookParser } from "../infrastructure/webhook/WebhookParser.js";
import { WebhookVerifier } from "../infrastructure/webhook/WebhookVerifier.js";
import type { AdResolver } from "../mappers/LeadMapper.js";
import { AdAccountRegistry } from "../registry/AdAccountRegistry.js";

export interface MetaAdsConnectorFactoryOptions {
  readonly config: MetaAdsConnectorConfig;
  /** Real `@aos/event-bus` `IPublisher` — always caller-supplied (the composed event bus is an app-level concern, not something this package bootstraps). */
  readonly publisher: IPublisher;
  readonly logger?: Logger;
  readonly tracer?: Tracer;
  /** Injectable clock, threaded through every time-dependent component (`PullCampaignData`, `ExecuteVerdict`, `WebhookParser`) — defaults to the real wall clock only here, at the outermost composition boundary. */
  readonly now?: () => Date;
  /** Injectable `fetch`, forwarded to `MetaApiClient` — primarily for tests. */
  readonly fetchImpl?: typeof fetch;
}

export interface MetaAdsConnector {
  readonly syncService: MetaAdsSyncService;
  readonly verdictService: VerdictExecutionService;
  readonly pullCampaignData: PullCampaignData;
  readonly executeVerdict: ExecuteVerdict;
  readonly processLeadWebhook: ProcessLeadWebhook;
  readonly registry: AdAccountRegistry;
  readonly rateLimiter: TokenBucketRateLimiter;
}

/**
 * The composition root (Factory Pattern) — the single place every real `@aos/*` integration
 * (`@aos/event-bus` `IPublisher`, `@aos/logger` `createLogger`, `@aos/telemetry` `getTracer`)
 * and every infrastructure adapter (`MetaApiClient`, `TokenBucketRateLimiter`,
 * `ExponentialBackoffRetry`, `WebhookVerifier`/`WebhookParser`) gets wired together into the
 * three use cases + two composition-level services the public API exposes.
 */
export class MetaAdsConnectorFactory {
  static create(options: MetaAdsConnectorFactoryOptions): MetaAdsConnector {
    const logger = options.logger ?? createLogger({ serviceName: "meta-ads-connector" });
    const tracer: Tracer = options.tracer ?? getTracer("meta-ads-connector");
    const now = options.now ?? (() => new Date());

    const client = new MetaApiClient({
      timeoutMs: options.config.timeoutMs,
      fetchImpl: options.fetchImpl,
    });
    const rateLimiter = new TokenBucketRateLimiter({ capacity: options.config.rateLimitPerHour });
    const retry = new ExponentialBackoffRetry({
      maxAttempts: options.config.retryMaxAttempts,
      baseDelayMs: options.config.retryBaseDelayMs,
    });
    const registry = new AdAccountRegistry();
    const events = new MetaAdsConnectorEvents(options.publisher);

    const verdictService = new VerdictExecutionService(client, rateLimiter, retry);
    const pullCampaignData = new PullCampaignData(
      client,
      rateLimiter,
      retry,
      registry,
      events,
      logger,
      tracer,
      now,
    );
    const executeVerdict = new ExecuteVerdict(verdictService, events, logger, tracer, now);

    const webhookVerifier = new WebhookVerifier();
    const webhookParser = new WebhookParser({ now });
    const resolveAd: AdResolver = (metaAdId) => {
      const found = registry.resolveAdByMetaId(metaAdId);
      return found.some
        ? ok(found.value)
        : err(
            new ValidationError(
              `No synced ad found for Meta ad id "${metaAdId}" — run PullCampaignData for its ad account first`,
            ),
          );
    };
    const processLeadWebhook = new ProcessLeadWebhook(
      webhookVerifier,
      webhookParser,
      resolveAd,
      events,
      logger,
      tracer,
    );

    const syncService = new MetaAdsSyncService(pullCampaignData);

    return {
      syncService,
      verdictService,
      pullCampaignData,
      executeVerdict,
      processLeadWebhook,
      registry,
      rateLimiter,
    };
  }
}
