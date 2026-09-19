import { randomUUID } from "node:crypto";

import { NotFoundError, ValidationError } from "@aos/errors";
import {
  AdAccountId,
  AdStatus,
  MetaAdsSyncService,
  Verdict,
  type AdAccount,
} from "@aos/meta-ads-connector";
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";

import { META_ADS_CONNECTOR_REGISTRY } from "../../di-tokens.js";
import { CreativePackagesService } from "../creative-packages/creative-packages.service.js";
import {
  AdTenantIndexRepository,
  indexPulledAdAccount,
} from "../meta-ads/infrastructure/ad-tenant-index.repository.js";
import type {
  MetaAdsConnectorContext,
  MetaAdsConnectorRegistry,
} from "../meta-ads/infrastructure/meta-ads-connector-registry.js";
import type { CalendarEventResult } from "../scheduler/domain/calendar-event.js";

import type { AbTestStatus, StoredAbTest, StoredAbTestVariant } from "./domain/ab-test.js";
import { angleSetKey, selectUnusedAngleSet, variantLabelForIndex } from "./domain/angle-pairs.js";
import {
  assessVariantSufficiency,
  decideWinner,
  isExperimentReadyToDecide,
  isThresholdMet,
  type VariantInsight,
} from "./domain/winner-decision.js";
import type { AbTestVariantMedia } from "./dto/ab-test-response.dto.js";
import type { CreateAbTestBodyDto } from "./dto/create-ab-test.dto.js";
import { AbTestVariantRepository } from "./infrastructure/ab-test-variant.repository.js";
import { AbTestRepository } from "./infrastructure/ab-test.repository.js";

const MS_PER_DAY = 86_400_000;

/**
 * Backs `/api/v1/abtesting/*` and the `AB_TEST_CHECK` Kalender handler (AAOS-ABTESTING-LOOKALIKE).
 * Single-tenant per call, exactly like every other service in this app (coordinator note section
 * 4) — every method operates on one real `tenantId`/the single composed `MetaAdsConnector` for
 * that tenant, no per-tenant loop.
 *
 * TENANT-SCOPING FIX (Phase T2, docs/PROMPT-AAOS-META-ADS-TENANT-SCOPING.md): every method that
 * used to read the private `tenantId` getter (itself just an alias for the single, process-wide
 * `config.AAOS_TENANT_ID`) now takes a real `tenantId` parameter instead — removed entirely, per
 * this phase's own note ("removed once nothing real calls it anymore", verified via grep). The
 * `/api/v1/abtesting*` HTTP endpoints (`AbTestingController`) now pass the real per-request tenant
 * (`@TenantId()`); the `AB_TEST_CHECK` Kalender handler (`SchedulerService`, no per-request tenant
 * context — a background cron job, not an HTTP request) explicitly passes its own
 * `config.AAOS_TENANT_ID`, preserving today's exact single-tenant background behavior.
 *
 * Reuses the REAL existing capabilities per coordinator note section 1: creative generation goes
 * through the SAME `CreativePackagesService`/Kai pipeline every manual/Samantha-approved brief
 * already uses (no second creative pipeline), and winner declaration (pause loser / scale winner
 * +20%) goes through the SAME `connector.verdictService` (`Verdict.PAUSE`/`Verdict.SCALE`) Go
 * Live's rollback and Samantha's own optimization cycle already use — not a fabricated
 * `updateAdSetBudget(id, budget * 1.2)` call.
 */
@Injectable()
export class AbTestingService {
  private readonly logger = new Logger(AbTestingService.name);

  constructor(
    @Inject(META_ADS_CONNECTOR_REGISTRY)
    private readonly connectorRegistry: MetaAdsConnectorRegistry,
    private readonly creativePackages: CreativePackagesService,
    private readonly testRepository: AbTestRepository,
    private readonly variantRepository: AbTestVariantRepository,
    private readonly adTenantIndex: AdTenantIndexRepository,
    // `@Optional()` — see `RecyclingService`'s own `now` param doc; a bare `Function`-typed
    // constructor param with only a default value still gets a real DI resolution attempt from
    // Nest without this, crashing bootstrap.
    @Optional() private readonly now: () => Date = () => new Date(),
  ) {}

  /**
   * AAOS-MULTI-TENANT-PHASE1B (Phase 3): resolves this tenant's own `MetaAdsConnector` (real
   * `Result.err(ConnectorNotConfiguredError)` re-thrown as-is on an unconfigured tenant, never a
   * thrown-away exception). Was a constructor-time `this.syncService = new
   * MetaAdsSyncService(this.connector.pullCampaignData)` before this phase — moved to a per-call
   * resolve since `MetaAdsConnectorRegistry.resolve` is async and the old static connector no
   * longer exists to compose from eagerly at construction time.
   */
  private async resolveConnector(tenantId: string): Promise<{
    readonly connector: MetaAdsConnectorContext;
    readonly syncService: MetaAdsSyncService;
  }> {
    const result = await this.connectorRegistry.resolve(tenantId);
    if (!result.ok) {
      throw result.error;
    }
    return {
      connector: result.value,
      syncService: new MetaAdsSyncService(result.value.pullCampaignData),
    };
  }

  // ---------------------------------------------------------------------------------------------
  // CRUD — `GET/POST /api/v1/abtesting*`.
  // ---------------------------------------------------------------------------------------------

  async listTests(tenantId: string, status?: AbTestStatus): Promise<readonly StoredAbTest[]> {
    return this.testRepository.listByTenant(tenantId, status);
  }

  async getTest(
    id: string,
    tenantId: string,
  ): Promise<{ readonly test: StoredAbTest; readonly variants: readonly StoredAbTestVariant[] }> {
    const test = await this.findOrThrow(id, tenantId);
    const variants = await this.variantRepository.listByAbTest(id);
    return { test, variants };
  }

  /**
   * `POST /api/v1/abtesting` — Mode Auto: picks an angle set this campaign hasn't tested yet
   * (spec's `selectUnusedAnglePair`), then kicks off one REAL `CreativePackagesService.create({
   * generate: true })` per variant (spec's `generateABVariants`). Returns immediately with the
   * test in `DRAFT` and every variant `PENDING_CREATIVE` — Kie AI generation is asynchronous
   * (`CreativePackagesService`'s own detached pipeline), so nothing here waits for it. The
   * `AB_TEST_CHECK` handler launches the test onto Meta once every variant's creative finishes.
   */
  async createTest(body: CreateAbTestBodyDto, tenantId: string): Promise<StoredAbTest> {
    const usedKeys = await this.usedAngleKeysForCampaign(body.campaignId, tenantId);
    const angleSet = selectUnusedAngleSet(usedKeys, body.variantCount);

    const test = await this.testRepository.create({
      id: randomUUID(),
      tenantId,
      name: body.name,
      campaignId: body.campaignId,
      adSetId: body.adSetId,
      pageId: body.pageId,
      waLink: body.waLink,
      mode: body.mode,
      thresholdSpend: body.thresholdSpend,
      thresholdDays: body.thresholdDays,
      minMarginPct: body.minMarginPct,
      autoPauseLoser: body.autoPauseLoser,
      autoScaleWinner: body.autoScaleWinner,
    });

    for (let index = 0; index < angleSet.length; index += 1) {
      const angle = angleSet[index];
      /* v8 ignore next -- unreachable: `index < angleSet.length` guarantees a value. */
      if (angle === undefined) {
        continue;
      }
      const label = variantLabelForIndex(index);
      const pkg = await this.creativePackages.create({
        unit: body.unit,
        ...(body.unitModel !== undefined ? { unitModel: body.unitModel } : {}),
        branch: body.branch,
        angle,
        targetPersona: body.targetPersona,
        primaryMessage: body.primaryMessage,
        format: body.format,
        urgency: body.urgency,
        title: `${body.name} — Variant ${label}`,
        origin: "MANUAL",
        reason: `A/B test "${body.name}" variant ${label} (${angle}).`,
        generate: true,
      });
      await this.variantRepository.create({
        id: randomUUID(),
        abTestId: test.id,
        tenantId,
        variantLabel: label,
        angle,
        creativePackageId: pkg.id,
      });
    }

    return this.findOrThrow(test.id, tenantId);
  }

  async pauseTest(id: string, tenantId: string): Promise<StoredAbTest> {
    await this.findOrThrow(id, tenantId);
    await this.testRepository.markStatus(id, "PAUSED");
    return this.findOrThrow(id, tenantId);
  }

  // ---------------------------------------------------------------------------------------------
  // `AB_TEST_CHECK` Kalender handler — launches DRAFT tests whose creatives finished, and monitors
  // RUNNING tests for a winner (spec's `monitorABTests`/`declareWinner`, every ~6 hours).
  // ---------------------------------------------------------------------------------------------

  async runAbTestCheck(tenantId: string): Promise<CalendarEventResult> {
    const launched = await this.launchReadyDraftTests(tenantId);
    const declared = await this.monitorRunningTests(tenantId);
    return {
      summary: `${String(launched)} test di-launch · ${String(declared)} winner ditemukan`,
      launched,
      winnersDeclared: declared,
    };
  }

  /** Advances every `DRAFT` test's variants past `PENDING_CREATIVE`, then launches the test onto Meta once every variant is `READY`. */
  private async launchReadyDraftTests(tenantId: string): Promise<number> {
    const draftTests = await this.testRepository.listByStatus(tenantId, "DRAFT");
    let launchedCount = 0;
    for (const test of draftTests) {
      const variants = await this.variantRepository.listByAbTest(test.id);
      let anyFailed = false;
      for (const variant of variants) {
        if (variant.status !== "PENDING_CREATIVE") {
          continue;
        }
        const detail = await this.creativePackages.byId(variant.creativePackageId);
        if (detail.package.status === "FAILED") {
          await this.variantRepository.markStatus(variant.id, "FAILED");
          anyFailed = true;
        } else if (detail.package.status === "PENDING" || detail.package.status === "APPROVED") {
          await this.variantRepository.markStatus(variant.id, "READY");
        }
        // GENERATING/DRAFT/REJECTED: still waiting, or not applicable — leave PENDING_CREATIVE.
      }
      if (anyFailed) {
        await this.testRepository.markFailed(
          test.id,
          "Satu atau lebih variant gagal generate creative.",
        );
        continue;
      }
      const refreshed = await this.variantRepository.listByAbTest(test.id);
      if (refreshed.length > 0 && refreshed.every((variant) => variant.status === "READY")) {
        const ok = await this.launchTest(test, refreshed, tenantId);
        if (ok) {
          launchedCount += 1;
        }
      }
    }
    return launchedCount;
  }

  /** Creates one real Meta ad per `READY` variant (spec's `launchABTest`), then flips the test to `RUNNING`. Any single variant's ad-creation failure fails the whole test — a partially-launched A/B test is not a valid state to monitor. */
  private async launchTest(
    test: StoredAbTest,
    variants: readonly StoredAbTestVariant[],
    tenantId: string,
  ): Promise<boolean> {
    const { connector } = await this.resolveConnector(tenantId);
    const adAccountIdResult = AdAccountId.create(this.requireAdAccountId(connector.adAccountIds));
    if (!adAccountIdResult.ok) {
      await this.testRepository.markFailed(test.id, adAccountIdResult.error.message);
      return false;
    }
    const accessToken = connector.accessToken;

    for (const variant of variants) {
      const detail = await this.creativePackages.byId(variant.creativePackageId);
      const hostedUrl = detail.package.videoUrl ?? detail.package.imageUrls[0];
      if (hostedUrl === undefined) {
        await this.variantRepository.markStatus(variant.id, "FAILED");
        await this.testRepository.markFailed(
          test.id,
          `Variant ${variant.variantLabel}: creative package tidak punya video/gambar.`,
        );
        return false;
      }
      const primaryText = detail.package.copyVariants[0]?.primaryText;
      if (primaryText === undefined) {
        await this.variantRepository.markStatus(variant.id, "FAILED");
        await this.testRepository.markFailed(
          test.id,
          `Variant ${variant.variantLabel}: creative package tidak punya copy variant.`,
        );
        return false;
      }

      const assetType = detail.package.videoUrl !== undefined ? "VIDEO" : "IMAGE";
      const uploadResult = await connector.uploadCreativeAsset.execute({
        adAccountId: adAccountIdResult.value,
        assetType,
        hostedUrl,
        accessToken,
      });
      if (!uploadResult.ok) {
        await this.variantRepository.markStatus(variant.id, "FAILED");
        await this.testRepository.markFailed(test.id, uploadResult.error.message);
        return false;
      }

      const createAdResult = await connector.createAd.execute({
        adAccountId: adAccountIdResult.value,
        adSetId: test.adSetId,
        name: `${test.name}-Variant${variant.variantLabel}`,
        pageId: test.pageId,
        creative:
          assetType === "VIDEO"
            ? {
                kind: "VIDEO",
                videoId: uploadResult.value.assetId,
                thumbnailUrl: detail.package.imageUrls[0] ?? hostedUrl,
                message: primaryText,
                callToActionType: "WHATSAPP_MESSAGE",
              }
            : {
                kind: "IMAGE",
                imageHash: uploadResult.value.assetId,
                linkUrl: test.waLink,
                message: primaryText,
                callToActionType: "WHATSAPP_MESSAGE",
              },
        accessToken,
        status: AdStatus.ACTIVE,
      });
      if (!createAdResult.ok) {
        await this.variantRepository.markStatus(variant.id, "FAILED");
        await this.testRepository.markFailed(test.id, createAdResult.error.message);
        return false;
      }
      await this.variantRepository.markLaunched(variant.id, createAdResult.value.adId);
    }

    await this.testRepository.markRunning(test.id, this.now().toISOString());
    return true;
  }

  /** Re-pulls every configured ad account (SAME `PullCampaignData` use case every other Samantha feature uses — coordinator note section 1), matches each `RUNNING` variant's `meta_ad_id`, updates its stored insights, and declares a winner once the threshold+margin are met. */
  private async monitorRunningTests(tenantId: string): Promise<number> {
    const runningTests = await this.testRepository.listByStatus(tenantId, "RUNNING");
    if (runningTests.length === 0) {
      return 0;
    }
    const { connector } = await this.resolveConnector(tenantId);
    const adAccounts = await this.pullAdAccounts(tenantId);
    const allAds = adAccounts.flatMap((account) =>
      account.campaigns.flatMap((campaign) =>
        campaign.adSets.flatMap((adSet) => adSet.ads.map((ad) => ({ adSet, ad }))),
      ),
    );

    let declared = 0;
    const nowIso = this.now().toISOString();
    for (const test of runningTests) {
      const variants = await this.variantRepository.listByAbTest(test.id);
      const insights: VariantInsight[] = [];
      for (const variant of variants) {
        if (variant.metaAdId === undefined) {
          continue;
        }
        const match = allAds.find((entry) => entry.ad.metaId === variant.metaAdId);
        if (match === undefined) {
          continue;
        }
        const spend = match.ad.metrics.spend.toNumber();
        const impressions = match.ad.metrics.impressions;
        const clicks = match.ad.metrics.clicks;
        const leads = match.ad.metrics.totalLead;
        const rphLead = match.ad.metrics.rphLead.value;
        const ctr = impressions > 0 ? clicks / impressions : null;
        await this.variantRepository.updateInsights(variant.id, {
          spend,
          impressions,
          clicks,
          conversations: match.ad.metrics.conversations,
          leads,
          rphLead,
          ctr,
          lastSyncedAtIso: nowIso,
        });
        insights.push({ variantId: variant.id, spend, impressions, clicks, leads, rphLead });
      }

      if (insights.length < 2 || test.startedAt === undefined) {
        continue;
      }
      const totalSpend = insights.reduce((sum, insight) => sum + insight.spend, 0);
      const daysRunning = Math.floor(
        (this.now().getTime() - new Date(test.startedAt).getTime()) / MS_PER_DAY,
      );
      if (!isThresholdMet(totalSpend, test.thresholdSpend, daysRunning, test.thresholdDays)) {
        continue;
      }
      // PROMPT 27 "Experiment Engine" (Phase 35): combined `isThresholdMet` above does not catch a
      // single variant still resting on a too-thin real sample (see `winner-decision.ts`'s own doc)
      // — check every variant's OWN sufficiency before even attempting `decideWinner`. A real
      // "keep testing" state, same as `decideWinner` returning `undefined`, never a forced decision.
      const sufficiencies = assessVariantSufficiency(insights, daysRunning);
      if (!isExperimentReadyToDecide(sufficiencies)) {
        continue;
      }
      const decision = decideWinner(insights, test.minMarginPct);
      if (decision === undefined) {
        continue;
      }

      if (test.autoPauseLoser) {
        for (const loserVariantId of decision.loserVariantIds) {
          const loser = variants.find((variant) => variant.id === loserVariantId);
          if (loser?.metaAdId === undefined) {
            continue;
          }
          const pauseResult = await connector.verdictService.execute({
            verdict: Verdict.PAUSE,
            targetId: loser.metaAdId,
            targetType: "ad",
            accessToken: connector.accessToken,
          });
          if (!pauseResult.ok) {
            this.logger.warn(
              `AbTestingService.monitorRunningTests: pause failed for variant ${loser.id}: ${pauseResult.error.message}`,
            );
          }
          await this.variantRepository.markStatus(loser.id, "PAUSED_LOSER");
        }
      }
      if (test.autoScaleWinner) {
        const winnerAdSet = allAds.find(
          (entry) =>
            entry.ad.metaId === variants.find((v) => v.id === decision.winnerVariantId)?.metaAdId,
        )?.adSet;
        if (winnerAdSet !== undefined) {
          const scaleResult = await connector.verdictService.execute({
            verdict: Verdict.SCALE,
            targetId: test.adSetId,
            targetType: "adset",
            accessToken: connector.accessToken,
            currentDailyBudgetIDR: winnerAdSet.dailyBudget.toNumber(),
          });
          if (!scaleResult.ok) {
            this.logger.warn(
              `AbTestingService.monitorRunningTests: scale failed for test ${test.id}: ${scaleResult.error.message}`,
            );
          }
        }
      }
      await this.variantRepository.markStatus(decision.winnerVariantId, "WINNER");
      await this.testRepository.markComplete(
        test.id,
        decision.winnerVariantId,
        decision.winnerRphLead,
        decision.improvementPct,
        nowIso,
      );
      declared += 1;
    }
    return declared;
  }

  // ---------------------------------------------------------------------------------------------
  // Internals.
  // ---------------------------------------------------------------------------------------------

  /** Every angle-set key already tested for one campaign (spec's "belum pernah di-test untuk campaign ini") — every prior test's variants, regardless of status. */
  private async usedAngleKeysForCampaign(
    campaignId: string,
    tenantId: string,
  ): Promise<ReadonlySet<string>> {
    const priorTests = await this.testRepository.listByCampaign(tenantId, campaignId);
    const keys = new Set<string>();
    for (const test of priorTests) {
      const variants = await this.variantRepository.listByAbTest(test.id);
      if (variants.length === 0) {
        continue;
      }
      keys.add(angleSetKey(variants.map((variant) => variant.angle)));
    }
    return keys;
  }

  private requireAdAccountId(adAccountIds: readonly string[]): string {
    const id = adAccountIds[0];
    if (id === undefined) {
      throw new ValidationError("No META_AD_ACCOUNT_IDS configured");
    }
    return id;
  }

  private async pullAdAccounts(tenantId: string): Promise<readonly AdAccount[]> {
    const { connector, syncService } = await this.resolveConnector(tenantId);
    const correlationId = randomUUID();
    const inputs = connector.adAccountIds.map((rawId) => {
      const idResult = AdAccountId.create(rawId);
      if (!idResult.ok) {
        throw idResult.error;
      }
      return {
        adAccountId: idResult.value,
        datePreset: "last_30d",
        accessToken: connector.accessToken,
        tenantId,
        correlationId,
      } as const;
    });
    const results = await syncService.syncAccounts(inputs);
    const adAccounts: AdAccount[] = [];
    for (const result of results) {
      if (result.ok) {
        adAccounts.push(result.value);
      } else {
        this.logger.warn(`AbTestingService.pullAdAccounts: ${result.error.message}`);
      }
    }
    // AAOS-MULTI-TENANT-PHASE1C — best-effort, never-throwing index of every successfully-pulled
    // ad's real Meta id -> tenant, so a later Meta lead webhook can resolve this tenant honestly.
    for (const adAccount of adAccounts) {
      await indexPulledAdAccount(this.adTenantIndex, tenantId, adAccount);
    }
    return adAccounts;
  }

  /**
   * Real, best-effort creative-thumbnail lookup for the A/B Testing UI (user-reported gap: "di
   * creative ab testing asset image/video gabisa di render"). Reuses the EXACT same real lookup
   * `launchTest` above already performs (`creativePackages.byId(variant.creativePackageId)` ->
   * `package.videoUrl`/`package.imageUrls[0]`) — never a second, parallel media source, and never a
   * fabricated placeholder: a variant whose package was deleted, or is still generating with no
   * media yet, simply gets no entry in the returned map (the DTO layer renders an honest icon
   * instead). Runs in parallel across variants (`Promise.all`) since each lookup is an independent
   * read with no ordering dependency.
   */
  async getVariantsMedia(
    variants: readonly StoredAbTestVariant[],
  ): Promise<ReadonlyMap<string, AbTestVariantMedia>> {
    const entries = await Promise.all(
      variants.map(async (variant) => {
        try {
          const detail = await this.creativePackages.byId(variant.creativePackageId);
          const videoUrl = detail.package.videoUrl;
          const imageUrl = detail.package.imageUrls[0];
          const representativeCopy = detail.package.copyVariants[0];
          if (
            videoUrl === undefined &&
            imageUrl === undefined &&
            representativeCopy === undefined
          ) {
            return undefined;
          }
          const media: AbTestVariantMedia = {
            ...(imageUrl !== undefined ? { imageUrl } : {}),
            ...(videoUrl !== undefined ? { videoUrl } : {}),
            ...(videoUrl !== undefined || imageUrl !== undefined
              ? { assetKind: (videoUrl !== undefined ? "VIDEO" : "IMAGE") as "IMAGE" | "VIDEO" }
              : {}),
            ...(representativeCopy?.primaryText !== undefined
              ? { primaryText: representativeCopy.primaryText }
              : {}),
            ...(representativeCopy?.headline !== undefined
              ? { headline: representativeCopy.headline }
              : {}),
          };
          return [variant.id, media] as const;
        } catch (caught) {
          this.logger.warn(
            `AbTestingService.getVariantsMedia: creative package lookup failed for variant ${variant.id}, rendering without a real thumbnail: ${caught instanceof Error ? caught.message : String(caught)}`,
          );
          return undefined;
        }
      }),
    );
    return new Map(
      entries.filter(
        (entry): entry is readonly [string, AbTestVariantMedia] => entry !== undefined,
      ),
    );
  }

  private async findOrThrow(id: string, tenantId: string): Promise<StoredAbTest> {
    const test = await this.testRepository.findById(tenantId, id);
    if (test === undefined) {
      throw new NotFoundError(`No A/B test found with id "${id}"`);
    }
    return test;
  }
}
