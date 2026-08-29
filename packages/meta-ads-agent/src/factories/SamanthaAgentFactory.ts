import { err, ErrorCode, ok, type Result } from "@aos/common";
import type { IPublisher } from "@aos/event-bus";
import { createLogger, type Logger } from "@aos/logger";
import type { AdAccountId, ExecuteVerdict } from "@aos/meta-ads-connector";
import { MobixScraperFactory, type ScrapedPromo, type ScrapedUnit } from "@aos/mobix-web-scraper";
import { getTracer } from "@aos/telemetry";

import { DecisionEngineService } from "../application/services/DecisionEngineService.js";
import { DigestService } from "../application/services/DigestService.js";
import { EscalationService } from "../application/services/EscalationService.js";
import { ExecutionService } from "../application/services/ExecutionService.js";
import {
  HistoricalLearningService,
  type PullCampaignDataPort,
} from "../application/services/HistoricalLearningService.js";
import { SamanthaAgentService } from "../application/services/SamanthaAgentService.js";
import { ApproveDecision } from "../application/use-cases/ApproveDecision.js";
import { ExecuteDecision } from "../application/use-cases/ExecuteDecision.js";
import { GenerateCreativeBrief } from "../application/use-cases/GenerateCreativeBrief.js";
import { GenerateDailyDigest } from "../application/use-cases/GenerateDailyDigest.js";
import { GetAgentStatus } from "../application/use-cases/GetAgentStatus.js";
import { RejectDecision } from "../application/use-cases/RejectDecision.js";
import {
  RunOptimizationCycle,
  type Tracer,
} from "../application/use-cases/RunOptimizationCycle.js";
import { CreativeBriefBuilder } from "../builders/CreativeBriefBuilder.js";
import type { MetaAdsAgentConfig } from "../config/MetaAdsAgentConfig.js";
import { AgentError } from "../domain/errors/index.js";
import { MetaAdsAgentEvents } from "../domain/events/MetaAdsAgentEvents.js";
import { createSeasonalPattern } from "../domain/value-objects/SeasonalPattern.js";
import {
  BusinessKnowledgeBase,
  KNOWN_EVERGREEN_PATTERNS,
  KNOWN_FATIGUE_PATTERNS,
} from "../intelligence/BusinessKnowledgeBase.js";
import { OptimizationPipeline } from "../intelligence/OptimizationPipeline.js";
import { VerdictDecisionEngine } from "../intelligence/VerdictDecisionEngine.js";
import { AgentRegistry } from "../registry/AgentRegistry.js";
import { DecisionRegistry } from "../registry/DecisionRegistry.js";

export interface SamanthaAgentFactoryOptions {
  readonly config: MetaAdsAgentConfig;
  /** Real `@aos/event-bus` `IPublisher` — always caller-supplied, mirroring `@aos/objective-engine`'s `ObjectiveEngineFactory`. */
  readonly publisher: IPublisher;
  /** The composed `@aos/meta-ads-connector` `ExecuteVerdict` use case — Samantha's only path to the Meta API, always injected, never constructed here (this package has zero networking of its own). */
  readonly executeVerdict: ExecuteVerdict;
  /** The Meta access token forwarded to `ExecuteVerdict` for every AUTO_EXECUTE call. */
  readonly metaAccessToken: string;
  readonly logger?: Logger;
  readonly tracer?: Tracer;
  /** Injectable clock, threaded through every time-dependent component — defaults to the real wall clock only here, at the outermost composition boundary. */
  readonly now?: () => Date;
}

/** The fully-wired composition object returned by `SamanthaAgentFactory.create()` — named distinctly from the `SamanthaAgent` domain entity (`domain/entities/SamanthaAgent.ts`) it internally owns via `samanthaAgentService`, mirroring `@aos/objective-engine`'s `ObjectiveEngine` / `@aos/meta-ads-connector`'s `MetaAdsConnector` composition-object naming. */
export interface SamanthaAgentRuntime {
  readonly runOptimizationCycle: RunOptimizationCycle;
  readonly executeDecision: ExecuteDecision;
  readonly generateCreativeBrief: GenerateCreativeBrief;
  readonly generateDailyDigest: GenerateDailyDigest;
  readonly approveDecision: ApproveDecision;
  readonly rejectDecision: RejectDecision;
  readonly getAgentStatus: GetAgentStatus;
  readonly samanthaAgentService: SamanthaAgentService;
  readonly decisionEngineService: DecisionEngineService;
  readonly escalationService: EscalationService;
  readonly agentRegistry: AgentRegistry;
  readonly decisionRegistry: DecisionRegistry;
}

/**
 * The composition root (Factory Pattern) — the single place every real `@aos/*` integration
 * (`@aos/event-bus` `IPublisher`, `@aos/logger` `createLogger`, `@aos/telemetry` `getTracer`) and
 * every internal component (intelligence, builders, services) gets wired together into the seven
 * use cases the public API exposes, mirroring `@aos/objective-engine`'s `ObjectiveEngineFactory` /
 * `@aos/meta-ads-connector`'s `MetaAdsConnectorFactory`.
 *
 * `AgentMemory` (owned by the `SamanthaAgentService` constructed here) is created fresh on every
 * call — no persistence, no cross-instance sharing (spec: "Memory is reset on each
 * `SamanthaAgentFactory.create()` call").
 */
export class SamanthaAgentFactory {
  static create(options: SamanthaAgentFactoryOptions): SamanthaAgentRuntime {
    const logger = options.logger ?? createLogger({ serviceName: "meta-ads-agent" });
    const tracer: Tracer = options.tracer ?? getTracer("meta-ads-agent");
    const now = options.now ?? (() => new Date());

    const events = new MetaAdsAgentEvents(options.publisher);
    const agentRegistry = new AgentRegistry();
    const decisionRegistry = new DecisionRegistry();
    const samanthaAgentService = new SamanthaAgentService(
      options.config.tenantId,
      agentRegistry,
      decisionRegistry,
      now,
    );

    const pipeline = new OptimizationPipeline();
    const verdictEngine = new VerdictDecisionEngine(now);
    const decisionEngineService = new DecisionEngineService(verdictEngine, now);
    const executionService = new ExecutionService(
      options.executeVerdict,
      events,
      logger,
      options.metaAccessToken,
    );
    const escalationService = new EscalationService();
    const creativeBriefBuilder = new CreativeBriefBuilder(now, options.config.ctwaPhoneNumbers);
    const digestService = new DigestService(events);

    const generateCreativeBrief = new GenerateCreativeBrief(creativeBriefBuilder, events);

    const runOptimizationCycle = new RunOptimizationCycle(
      pipeline,
      decisionEngineService,
      executionService,
      escalationService,
      generateCreativeBrief,
      samanthaAgentService,
      decisionRegistry,
      events,
      options.config,
      logger,
      tracer,
      now,
    );

    const executeDecision = new ExecuteDecision(executionService);
    const generateDailyDigest = new GenerateDailyDigest(digestService);
    const approveDecision = new ApproveDecision(
      escalationService,
      samanthaAgentService.getMemory(),
      logger,
      now,
    );
    const rejectDecision = new RejectDecision(
      escalationService,
      samanthaAgentService.getMemory(),
      logger,
      now,
    );
    const getAgentStatus = new GetAgentStatus(samanthaAgentService, escalationService);

    return {
      runOptimizationCycle,
      executeDecision,
      generateCreativeBrief,
      generateDailyDigest,
      approveDecision,
      rejectDecision,
      getAgentStatus,
      samanthaAgentService,
      decisionEngineService,
      escalationService,
      agentRegistry,
      decisionRegistry,
    };
  }

  /**
   * AAOS-W1D-S1S2 (S1 + S2) — the combined-supplement single init entrypoint. Runs static Mobix
   * brand knowledge (instant), then S1 historical learning + S2 inventory/promo scraping IN
   * PARALLEL via `Promise.all`, then seeds the resulting `AgentMemory` — before returning a fully
   * usable `SamanthaAgentRuntime` (built via the existing `create()` above; nothing about the
   * composition wiring changes).
   *
   * S1/S2 failures are never fatal to this call: each of the three parallel results (historical
   * learning, inventory scrape, promo scrape) is handled independently — a failure is logged as a
   * warning and the corresponding `AgentMemory` fields are seeded from a safe fallback (the
   * package's `KNOWN_*` static seed data for S1, empty arrays for S2) instead. The ONLY way this
   * method returns `Result.err` is a structurally invalid `options.config` (surfaced by the
   * underlying `create()`'s `SamanthaAgentService` construction) — matching the task's requirement
   * that this always "returns a usable agent even under partial failure".
   */
  static async createWithFullContext(
    options: CreateWithFullContextOptions,
  ): Promise<Result<SamanthaAgentRuntime, AgentError>> {
    const logger = options.logger ?? createLogger({ serviceName: "meta-ads-agent" });
    const now = options.now ?? (() => new Date());
    const historicalDays = options.historicalDays ?? 90;
    const shouldScrapeInventory = options.scrapeInventory ?? true;

    // Step 1 — static Mobix brand knowledge, instant, no I/O.
    BusinessKnowledgeBase.loadMobixKnowledge();

    // `create()` never fails for real input (see its own `SamanthaAgentService` constructor
    // docstring) — the try/catch below is this method's one structural-failure guard, per this
    // method's own docstring ("the ONLY way this returns Result.err").
    let runtime: SamanthaAgentRuntime;
    try {
      runtime = SamanthaAgentFactory.create({ ...options, logger, now });
    } catch (error) {
      // Unreachable ternary false branch: `SamanthaAgentService`'s own constructor only ever
      // `throw new Error(...)` (see that file) — a non-Error thrown value can't occur here.
      /* v8 ignore next */
      const message =
        error instanceof Error ? error.message : "createWithFullContext: invalid config";
      return err(new AgentError(ErrorCode.VALIDATION_ERROR, message));
    }
    const memory = runtime.samanthaAgentService.getMemory();

    const historicalService = new HistoricalLearningService(
      options.pullCampaignData,
      options.config.tenantId,
      logger,
      now,
    );
    const mobixScraperService = MobixScraperFactory.create({
      publisher: options.publisher,
      now,
      ...options.mobixScraperOptions,
    });

    // Step 2 — S1 + S2 in parallel.
    const [historicalResult, inventoryResult, promoResult] = await Promise.all([
      historicalService.learn(options.adAccountId, options.metaAccessToken, historicalDays),
      shouldScrapeInventory
        ? mobixScraperService.scrapeInventoryUnits()
        : Promise.resolve(ok<ReadonlyArray<ScrapedUnit>>([])),
      shouldScrapeInventory
        ? mobixScraperService.scrapePromosList()
        : Promise.resolve(ok<ReadonlyArray<ScrapedPromo>>([])),
    ]);

    // Step 3 — seed AgentMemory with everything collected.
    if (historicalResult.ok) {
      memory.seedHistoricalLearnings({
        performanceBaselines: new Map(
          historicalResult.value.performanceBaselines
            .filter((b) => b.angle !== undefined)
            .map((b) => [`${b.branch}-${b.funnel}-${b.angle as string}`, b]),
        ),
        evergreenAdIds: historicalResult.value.evergreenAds,
        fatiguePatterns: historicalResult.value.fatiguePatterns,
        seasonalPatterns: historicalResult.value.seasonalPatterns,
        topAngles: historicalResult.value.topAngles,
      });
    } else {
      logger.warn(
        { error: historicalResult.error.message },
        "meta-ads-agent: createWithFullContext — S1 historical learning failed, falling back to " +
          "KNOWN_FATIGUE_PATTERNS/KNOWN_EVERGREEN_PATTERNS static seed data (KNOWN_PERFORMANCE_BASELINES " +
          "is branch×funnel-only, with no angle dimension, so it cannot populate the angle-scoped " +
          "performanceBaselines map the blended-avg lookup needs — see BusinessKnowledgeBase docstring)",
      );
      memory.seedHistoricalLearnings({
        performanceBaselines: new Map(),
        evergreenAdIds: [],
        fatiguePatterns: KNOWN_FATIGUE_PATTERNS,
        seasonalPatterns: createSeasonalPattern([]),
        topAngles: KNOWN_EVERGREEN_PATTERNS.filter((p) => p.topPerformer).map((p) => p.angle),
      });
    }

    if (inventoryResult.ok) {
      memory.seedInventory(inventoryResult.value, now());
    } else {
      logger.warn(
        { error: inventoryResult.error.message },
        "meta-ads-agent: createWithFullContext — S2 inventory scrape failed, falling back to empty inventory",
      );
      memory.seedInventory([], now());
    }

    if (promoResult.ok) {
      memory.seedPromos(promoResult.value);
    } else {
      logger.warn(
        { error: promoResult.error.message },
        "meta-ads-agent: createWithFullContext — S2 promo scrape failed, falling back to empty promos",
      );
      memory.seedPromos([]);
    }

    return ok(runtime);
  }
}

/** Options for `SamanthaAgentFactory.createWithFullContext()` — extends the base `create()` options with S1 (historical learning) and S2 (inventory scraping) inputs. */
export interface CreateWithFullContextOptions extends SamanthaAgentFactoryOptions {
  /** The composed `@aos/meta-ads-connector` `PullCampaignData` use case — S1's only path to Meta API history, always injected (mirrors `executeVerdict` — this package never constructs connector internals itself). */
  readonly pullCampaignData: PullCampaignDataPort;
  readonly adAccountId: AdAccountId;
  /** Default 90 — see `HistoricalLearningService`'s docstring for why the REAL pulled window is always 30 days regardless of this value. */
  readonly historicalDays?: 30 | 60 | 90;
  /** Default true. */
  readonly scrapeInventory?: boolean;
  /** Forwarded to `MobixScraperFactory.create()` (listing/promo URLs, custom `fetchImpl`) — everything except `publisher`/`now`, which this method always supplies itself. `@aos/mobix-web-scraper` doesn't export its `MobixScraperFactoryOptions` type from its public API, so it's derived structurally here via `Parameters<...>`. */
  readonly mobixScraperOptions?: Omit<
    Parameters<typeof MobixScraperFactory.create>[0],
    "publisher" | "now"
  >;
}
