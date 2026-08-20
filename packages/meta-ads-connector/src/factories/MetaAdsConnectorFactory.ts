import { err, ok } from "@aos/common";
import { ValidationError } from "@aos/errors";
import type { IPublisher } from "@aos/event-bus";
import { createLogger, type Logger } from "@aos/logger";
import { getTracer } from "@aos/telemetry";

import { MetaAdsSyncService } from "../application/services/MetaAdsSyncService.js";
import { VerdictExecutionService } from "../application/services/VerdictExecutionService.js";
import { ActivateAd } from "../application/use-cases/ActivateAd.js";
import { ActivateCampaign } from "../application/use-cases/ActivateCampaign.js";
import { CreateAd } from "../application/use-cases/CreateAd.js";
import { CreateCampaign } from "../application/use-cases/CreateCampaign.js";
import { ExecuteVerdict } from "../application/use-cases/ExecuteVerdict.js";
import { PauseCampaign } from "../application/use-cases/PauseCampaign.js";
import { ProcessLeadWebhook } from "../application/use-cases/ProcessLeadWebhook.js";
import { PullCampaignData, type Tracer } from "../application/use-cases/PullCampaignData.js";
import { SearchAdInterests } from "../application/use-cases/SearchAdInterests.js";
import { UploadCreativeAsset } from "../application/use-cases/UploadCreativeAsset.js";
import type { MetaAdsConnectorConfig } from "../config/MetaAdsConnectorConfig.js";
import type { IMetaAdsClient } from "../contracts/IMetaAdsClient.js";
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
  readonly createCampaign: CreateCampaign;
  /** AAOS-GO-LIVE: single-ad creation with a real creative attached — see `CreateAd`'s docstring. */
  readonly createAd: CreateAd;
  /** AAOS-GO-LIVE: real video/image asset upload into the ad account's asset library — see `UploadCreativeAsset`'s docstring. */
  readonly uploadCreativeAsset: UploadCreativeAsset;
  /** AAOS-GO-LIVE: campaign-level pause — used by Go Live rollback. */
  readonly pauseCampaign: PauseCampaign;
  /** AAOS-GO-LIVE: campaign-level activation — used by Go Live's create step and rollback's undo path. */
  readonly activateCampaign: ActivateCampaign;
  /** AAOS-GO-LIVE: ad-level activation (inverse of the verdict-driven `pauseAd`) — used by Go Live rollback to undo a PAUSE verdict. */
  readonly activateAd: ActivateAd;
  /**
   * AAOS-SIMULASI-TARGETING: read-only Meta ad-interest discovery
   * (`GET /search?type=adinterest`). Deliberately NOT connected to `createCampaign` — see
   * `SearchAdInterests`'s scope-boundary docstring.
   */
  readonly searchAdInterests: SearchAdInterests;
  readonly processLeadWebhook: ProcessLeadWebhook;
  readonly registry: AdAccountRegistry;
  readonly rateLimiter: TokenBucketRateLimiter;
  /**
   * The raw `IMetaAdsClient` port — exposed (unlike other infra internals, which stay private to
   * the use cases above) so `apps/aaos-api`'s `MetaAdsService` can call the small, standalone
   * `getAdAccount` lookup (multi-account pill selector, coordinator note #6 on
   * `docs/PROMPT-AAOS-DASHBOARD-LEAD-SPEND-CABANG-SOURCE.md`) without this package needing a
   * whole new use-case class just to wrap one lightweight read.
   */
  readonly client: IMetaAdsClient;
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
    const createCampaign = new CreateCampaign(
      client,
      rateLimiter,
      retry,
      events,
      logger,
      tracer,
      now,
    );

    const searchAdInterests = new SearchAdInterests(client, rateLimiter, retry, logger, tracer);

    const createAd = new CreateAd(client, rateLimiter, retry, logger, tracer);
    const uploadCreativeAsset = new UploadCreativeAsset(client, rateLimiter, retry, logger, tracer);
    const pauseCampaign = new PauseCampaign(client, rateLimiter, retry, logger, tracer);
    const activateCampaign = new ActivateCampaign(client, rateLimiter, retry, logger, tracer);
    const activateAd = new ActivateAd(client, rateLimiter, retry, logger, tracer);

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
      createCampaign,
      createAd,
      uploadCreativeAsset,
      pauseCampaign,
      activateCampaign,
      activateAd,
      searchAdInterests,
      processLeadWebhook,
      registry,
      rateLimiter,
      client,
    };
  }
}
