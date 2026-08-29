import type { BranchId } from "@aos/branch-manager";
import type { IPublisher } from "@aos/event-bus";
import type { GetClosingStats, IClosingRepository } from "@aos/lead-store";
import { createLogger, type Logger } from "@aos/logger";

import {
  AttributionEngineService,
  type CampaignDirectory,
} from "../application/services/AttributionEngineService.js";
import { ClosingAggregatorService } from "../application/services/ClosingAggregatorService.js";
import { ReportGeneratorService } from "../application/services/ReportGeneratorService.js";
import { SamanthaFeedService } from "../application/services/SamanthaFeedService.js";
import { CheckObjectiveCompletion } from "../application/use-cases/CheckObjectiveCompletion.js";
import { FeedToSamantha } from "../application/use-cases/FeedToSamantha.js";
import { GenerateClosingReport } from "../application/use-cases/GenerateClosingReport.js";
import { GetBranchPerformance } from "../application/use-cases/GetBranchPerformance.js";
import { GetCampaignAttribution } from "../application/use-cases/GetCampaignAttribution.js";
import { GetClosingPipeline } from "../application/use-cases/GetClosingPipeline.js";
import { GetUnitPerformance } from "../application/use-cases/GetUnitPerformance.js";
import type { ClosingTrackerConfig } from "../config/ClosingTrackerConfig.js";
import type {
  ActiveCampaignSnapshot,
  ICampaignActivityProvider,
} from "../contracts/ICampaignActivityProvider.js";
import { ClosingTrackerEvents } from "../domain/events/ClosingTrackerEvents.js";

/** An `ICampaignActivityProvider` that reports no active campaigns for any branch/date — the safe default when no `@aos/meta-ads-connector`-backed adapter is wired in. Fallback attribution (Method 2/3) simply finds nothing to attribute to; direct attribution (Method 1, reusing `@aos/lead-store`'s `GetClosingStats`) is entirely unaffected. */
class NullCampaignActivityProvider implements ICampaignActivityProvider {
  async getActiveCampaignsForBranch(
    _branch: BranchId,
    _date: Date,
  ): Promise<ReadonlyArray<ActiveCampaignSnapshot>> {
    return Promise.resolve([]);
  }

  async getActiveCampaignsForBranchInPeriod(
    _branch: BranchId,
    _fromDate: Date,
    _toDate: Date,
  ): Promise<ReadonlyArray<ActiveCampaignSnapshot>> {
    return Promise.resolve([]);
  }
}

export interface ClosingTrackerFactoryOptions {
  readonly config: ClosingTrackerConfig;
  /** Real `@aos/event-bus` `IPublisher` — always caller-supplied, the same composition-boundary discipline every prior AAOS package's factory establishes. */
  readonly publisher: IPublisher;
  /** The real `@aos/lead-store` `IClosingRepository` — typically `LeadStore.getClosingStats`'s own injected repository, or a fresh `ClosingRepository(supabaseClient)`. This package never constructs a Supabase client itself; that composition stays lead-store's responsibility. */
  readonly closingRepository: IClosingRepository;
  /** The real, already-composed `@aos/lead-store` `GetClosingStats` use case (its own `ISpendProvider` already wired) — reused verbatim for directly-attributed campaigns' Rp/SPK (coordinator note #1). */
  readonly getClosingStats: GetClosingStats;
  /** Optional port for "which campaigns were active for branch X on day Y" — powers fallback attribution (Method 2/3). Omit for a `NullCampaignActivityProvider` default (fallback attribution simply finds nothing). */
  readonly campaignActivityProvider?: ICampaignActivityProvider;
  /** Optional campaignId -> name/stableId directory for resolving `CampaignAttribution.campaignName`/`.stableId` on directly-attributed campaigns. Fallback-attributed campaigns resolve their own metadata from `ICampaignActivityProvider` responses regardless. */
  readonly campaignDirectory?: CampaignDirectory;
  readonly logger?: Logger;
  readonly now?: () => Date;
}

export interface ClosingTracker {
  readonly generateClosingReport: GenerateClosingReport;
  readonly getCampaignAttribution: GetCampaignAttribution;
  readonly getBranchPerformance: GetBranchPerformance;
  readonly getUnitPerformance: GetUnitPerformance;
  readonly feedToSamantha: FeedToSamantha;
  readonly checkObjectiveCompletion: CheckObjectiveCompletion;
  readonly getClosingPipeline: GetClosingPipeline;
  readonly closingAggregatorService: ClosingAggregatorService;
  readonly attributionEngineService: AttributionEngineService;
  readonly reportGeneratorService: ReportGeneratorService;
  readonly samanthaFeedService: SamanthaFeedService;
}

/** The composition root (Factory Pattern) — wires every service and use case. Mirrors `@aos/lead-store`'s `LeadStoreFactory` / `@aos/objective-engine`'s `ObjectiveEngineFactory`. */
export class ClosingTrackerFactory {
  static create(options: ClosingTrackerFactoryOptions): ClosingTracker {
    const logger = options.logger ?? createLogger({ serviceName: "closing-tracker" });
    const now = options.now ?? (() => new Date());

    const closingAggregatorService = new ClosingAggregatorService(
      options.closingRepository,
      options.getClosingStats,
    );
    const campaignActivityProvider =
      options.campaignActivityProvider ?? new NullCampaignActivityProvider();
    const attributionEngineService = new AttributionEngineService(
      campaignActivityProvider,
      options.config,
      options.campaignDirectory ?? new Map(),
    );
    const reportGeneratorService = new ReportGeneratorService(
      closingAggregatorService,
      attributionEngineService,
      options.config,
      now,
    );
    const samanthaFeedService = new SamanthaFeedService();
    const events = new ClosingTrackerEvents(options.publisher);

    const generateClosingReport = new GenerateClosingReport(reportGeneratorService, events, now);
    const getCampaignAttribution = new GetCampaignAttribution(reportGeneratorService);
    const getBranchPerformance = new GetBranchPerformance(reportGeneratorService);
    const getUnitPerformance = new GetUnitPerformance(reportGeneratorService);
    const feedToSamantha = new FeedToSamantha(
      reportGeneratorService,
      samanthaFeedService,
      events,
      now,
    );
    const checkObjectiveCompletion = new CheckObjectiveCompletion(
      reportGeneratorService,
      events,
      now,
    );
    const getClosingPipeline = new GetClosingPipeline(closingAggregatorService);

    logger.info({ tenantId: options.config.tenantId }, "closing-tracker: factory composed");

    return {
      generateClosingReport,
      getCampaignAttribution,
      getBranchPerformance,
      getUnitPerformance,
      feedToSamantha,
      checkObjectiveCompletion,
      getClosingPipeline,
      closingAggregatorService,
      attributionEngineService,
      reportGeneratorService,
      samanthaFeedService,
    };
  }
}
