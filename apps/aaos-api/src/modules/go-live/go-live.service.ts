import { ConflictError, NotFoundError, ValidationError } from "@aos/errors";
import {
  AdAccountId,
  AdStatus,
  CampaignObjective,
  AdDestinationType,
  type MetaAdsConnector,
} from "@aos/meta-ads-connector";
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import { AAOS_API_CONFIG, META_ADS_CONNECTOR } from "../../di-tokens.js";
import { WabaConfigRepository } from "../settings/infrastructure/waba-config.repository.js";
import type {
  GoLiveRollbackData,
  SimulationLogPayload,
  SimulationStep,
  StoredSimulation,
} from "../simulation/domain/simulation-record.js";
import {
  toSimulationStatusResponseDto,
  type SimulationStatusResponseDto,
} from "../simulation/dto/simulation-status.dto.js";
import { SimulationRepository } from "../simulation/infrastructure/simulation.repository.js";

import { GO_LIVE_CONFIRMATION_TEXT, type GoLiveBodyDto } from "./dto/go-live-body.dto.js";
import type { RollbackBodyDto } from "./dto/rollback-body.dto.js";

const OPTIMIZATION_GOAL_LEAD_GENERATION = "LEAD_GENERATION";
const BILLING_EVENT_IMPRESSIONS = "IMPRESSIONS";
const GO_LIVE_STEP: SimulationStep = "GO_LIVE";

/**
 * `POST /api/v1/simulation/:id/go-live` and `.../rollback` (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY
 * Phase 4). Read `docs/PROMPT-AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY.md` coordinator note section 6
 * (mandatory safety framing) and section 8 (real capability gaps) before changing anything here.
 *
 * HONEST DEVIATION (load-bearing, documented per this task's process note): Document 2 section F
 * describes Go Live as executing "the simulation's already-approved Tamara verdicts" via
 * `pauseAd`/`fixCampaignObjective`/`scaleAdSetBudget`. `TamaraStageResult.rekomendasi` (the only
 * Tamara output this simulation module stores) is free-text Indonesian
 * `{ aksi, target, alasan, estimasi }` — NOT a structured `{ verdict, targetId, targetType }`
 * tuple `ExecuteVerdict` could run mechanically. Parsing that free text into real Meta mutation
 * calls would mean guessing/inventing target ids — exactly the kind of fabricated automated
 * action this codebase's discipline forbids (see `SimulationService`'s own "never fabricated"
 * precedents). This step is therefore an honest, logged SKIP, not a fake execution — see
 * `logVerdictExecutionSkip`. `rollback_data.mutatedEntities` is consequently always `[]` today;
 * the type and the rollback replay loop below are kept real and tested for when a future task
 * gives Tamara structured verdict output to replay.
 */
@Injectable()
export class GoLiveService {
  private readonly logger = new Logger(GoLiveService.name);

  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    @Inject(META_ADS_CONNECTOR) private readonly connector: MetaAdsConnector,
    private readonly repository: SimulationRepository,
    private readonly wabaConfigRepository: WabaConfigRepository,
    // REAL BUG FIX (found via independent e2e verification): a bare `Function`-typed constructor
    // parameter with a default value still gets a real DI resolution attempt from Nest (it has no
    // way to know the default should just apply) — real bootstrap failed with "Nest can't resolve
    // dependencies of the GoLiveService (..., ?)" for this exact parameter, invisible to this
    // file's own unit tests because they construct GoLiveService manually (bypassing Nest's
    // container) and pass a fake clock directly. `@Optional()` tells Nest not to attempt
    // resolution, so the real container falls through to the default `() => new Date()` exactly
    // as intended, while manual test construction is unaffected.
    @Optional() private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    id: string,
    body: GoLiveBodyDto,
    correlationId: string,
  ): Promise<SimulationStatusResponseDto> {
    const simulation = await this.findOrThrow(id);

    // --- Guards: fail closed, ALL checked before any external call (coordinator note section 6) ---
    if (body.confirmation !== GO_LIVE_CONFIRMATION_TEXT) {
      throw new ValidationError(`Confirmation text must be exactly "${GO_LIVE_CONFIRMATION_TEXT}"`);
    }
    if (simulation.status !== "DONE") {
      throw new ConflictError(
        `Simulation "${id}" has status "${simulation.status}" — only a DONE simulation can go live`,
      );
    }
    if (simulation.decision !== "APPROVED") {
      throw new ValidationError(
        `Simulation "${id}" has decision "${simulation.decision ?? "undecided"}" — must be APPROVED to go live`,
      );
    }
    const overallScore = simulation.result?.scoring.overallScore;
    if (overallScore === undefined || overallScore < this.config.GO_LIVE_MIN_SCORE) {
      throw new ValidationError(
        `Simulation overallScore (${String(overallScore)}) is below GO_LIVE_MIN_SCORE (${this.config.GO_LIVE_MIN_SCORE})`,
      );
    }
    if (await this.repository.hasLiveSince(startOfTodayIso(this.now()))) {
      throw new ConflictError("A simulation has already gone live today (max 1 Go Live per day)");
    }
    const budgetCap = readObjectiveBudgetCap(simulation.objectiveSnapshot);
    if (budgetCap === undefined) {
      throw new ValidationError(
        "Simulation's objective snapshot has no numeric `budget` field — cannot verify the daily budget cap",
      );
    }
    if (body.dailyBudgetIDR > budgetCap) {
      throw new ValidationError(
        `dailyBudgetIDR (${body.dailyBudgetIDR}) exceeds the daily cap of objective.budget / 30 (${budgetCap})`,
      );
    }
    const rawAdAccountId = this.config.META_AD_ACCOUNT_IDS[0];
    if (rawAdAccountId === undefined) {
      throw new ValidationError("No META_AD_ACCOUNT_IDS is configured");
    }
    const adAccountIdResult = AdAccountId.create(rawAdAccountId);
    if (!adAccountIdResult.ok) {
      throw adAccountIdResult.error;
    }
    if (!this.config.GO_LIVE_DRY_RUN && this.config.META_PAGE_ID.length === 0) {
      throw new ValidationError(
        "META_PAGE_ID is not configured — required for a real (non-dry-run) Go Live's ad creative",
      );
    }

    const dryRun = this.config.GO_LIVE_DRY_RUN;
    await this.log(
      id,
      dryRun ? "INFO" : "WARN",
      dryRun
        ? "[DRY RUN] Go Live dimulai — tidak ada panggilan API eksternal nyata yang akan dilakukan."
        : "Go Live dimulai — panggilan API Meta NYATA akan dilakukan.",
      { dryRun, dailyBudgetIDR: body.dailyBudgetIDR, correlationId },
    );

    await this.logVerdictExecutionSkip(id);

    if (dryRun) {
      await this.log(
        id,
        "INFO",
        `[DRY RUN] Would create Campaign+AdSet (OUTCOME_LEADS, WHATSAPP, ACTIVE) on ${adAccountIdResult.value.toString()} with dailyBudgetIDR=${body.dailyBudgetIDR}.`,
      );
      await this.log(
        id,
        "INFO",
        `[DRY RUN] Would upload a ${body.creative.assetType} creative asset from ${body.creative.hostedUrl}.`,
      );
      await this.log(
        id,
        "INFO",
        "[DRY RUN] Would create a single Ad (status ACTIVE) under the new AdSet.",
      );
      await this.logJessyCheck(id, simulation, true);
      await this.logCapiCheck(id, true);
      await this.log(
        id,
        "INFO",
        "[DRY RUN] Go Live selesai (dry run) — tidak ada perubahan status/campaign nyata; simulasi tetap DONE.",
      );
      return this.statusOf(id);
    }

    // --- Real execution ---
    const accessToken = this.config.META_ACCESS_TOKEN;
    try {
      const campaignResult = await this.connector.client.createCampaign(
        adAccountIdResult.value.toString(),
        {
          name: `GoLive-${simulation.branch ?? "UMUM"}-${id.slice(0, 8)}`,
          objective: CampaignObjective.OUTCOME_LEADS,
          specialAdCategories: [],
          // Real deviation from `CreateCampaign`'s always-PAUSED rule (documented in this class's
          // header doc): Go Live only ever runs after DSS has already approved the simulation via
          // Step 6's Review & Approve, so there is no further human gate left to wait for here.
          status: AdStatus.ACTIVE,
        },
        accessToken,
      );
      if (!campaignResult.ok) {
        await this.log(id, "ERROR", `Campaign creation gagal: ${campaignResult.error.message}`);
        throw campaignResult.error;
      }
      const campaignId = campaignResult.value.id;
      await this.log(id, "INFO", `Campaign dibuat: ${campaignId} (status ACTIVE).`, { campaignId });

      const adSetResult = await this.connector.client.createAdSet(
        adAccountIdResult.value.toString(),
        {
          campaignId,
          name: `GoLive-${simulation.branch ?? "UMUM"}-${id.slice(0, 8)}-adset`,
          destinationType: AdDestinationType.WHATSAPP,
          optimizationGoal: OPTIMIZATION_GOAL_LEAD_GENERATION,
          billingEvent: BILLING_EVENT_IMPRESSIONS,
          dailyBudgetCents: Math.round(body.dailyBudgetIDR * 100),
          status: AdStatus.ACTIVE,
        },
        accessToken,
      );
      if (!adSetResult.ok) {
        await this.log(id, "ERROR", `AdSet creation gagal: ${adSetResult.error.message}`, {
          campaignId,
        });
        throw adSetResult.error;
      }
      const adSetId = adSetResult.value.id;
      await this.log(id, "INFO", `AdSet dibuat: ${adSetId} (status ACTIVE).`, {
        campaignId,
        adSetId,
      });

      const uploadResult = await this.connector.uploadCreativeAsset.execute({
        adAccountId: adAccountIdResult.value,
        assetType: body.creative.assetType,
        hostedUrl: body.creative.hostedUrl,
        accessToken,
      });
      if (!uploadResult.ok) {
        await this.log(id, "ERROR", `Upload creative asset gagal: ${uploadResult.error.message}`, {
          campaignId,
          adSetId,
        });
        throw uploadResult.error;
      }
      await this.log(
        id,
        "INFO",
        `Creative asset diupload: ${uploadResult.value.assetType} → ${uploadResult.value.assetId}.`,
        { campaignId, adSetId, assetId: uploadResult.value.assetId },
      );

      const waLink =
        body.creative.assetType === "IMAGE" ? await this.resolveWaLink(id, simulation) : undefined;
      const createAdResult = await this.connector.createAd.execute({
        adAccountId: adAccountIdResult.value,
        adSetId,
        name: `GoLive-${simulation.branch ?? "UMUM"}-${id.slice(0, 8)}-ad`,
        pageId: this.config.META_PAGE_ID,
        creative:
          body.creative.assetType === "VIDEO"
            ? {
                kind: "VIDEO",
                videoId: uploadResult.value.assetId,
                thumbnailUrl: body.creative.thumbnailUrl,
                message: body.creative.primaryText,
                callToActionType: "WHATSAPP_MESSAGE",
              }
            : {
                kind: "IMAGE",
                imageHash: uploadResult.value.assetId,
                // `waLink` is defined whenever `assetType === "IMAGE"` (see the branch above).
                linkUrl: waLink as string,
                message: body.creative.primaryText,
                callToActionType: "WHATSAPP_MESSAGE",
              },
        accessToken,
        status: AdStatus.ACTIVE,
      });
      if (!createAdResult.ok) {
        await this.log(id, "ERROR", `Ad creation gagal: ${createAdResult.error.message}`, {
          campaignId,
          adSetId,
        });
        throw createAdResult.error;
      }
      const adId = createAdResult.value.adId;
      await this.log(id, "INFO", `Ad dibuat: ${adId} (status ACTIVE).`, {
        campaignId,
        adSetId,
        adId,
      });

      await this.logJessyCheck(id, simulation, false);
      await this.logCapiCheck(id, false);

      const liveAt = this.now().toISOString();
      const rollbackData: GoLiveRollbackData = {
        newCampaignId: campaignId,
        newAdSetId: adSetId,
        newAdId: adId,
        // See this class's header doc — always empty today (honest, not a bug).
        mutatedEntities: [],
      };
      await this.repository.markLive(id, campaignId, adId, liveAt, rollbackData);
      await this.log(
        id,
        "INFO",
        `Go Live selesai — simulasi sekarang LIVE (campaignId=${campaignId}, adId=${adId}).`,
      );
      return this.statusOf(id);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      this.logger.error(`GoLiveService.execute(${id}) failed: ${message}`);
      // Simulation status stays whatever it already was (DONE) — never marked LIVE on a failed
      // sequence, per coordinator note section 6's "stop, don't partially execute" requirement.
      throw caught;
    }
  }

  async rollback(
    id: string,
    _body: RollbackBodyDto,
    correlationId: string,
  ): Promise<SimulationStatusResponseDto> {
    const simulation = await this.findOrThrow(id);
    if (simulation.status !== "LIVE") {
      throw new ConflictError(
        `Simulation "${id}" has status "${simulation.status}" — only a LIVE simulation can be rolled back`,
      );
    }
    if (simulation.liveAt === undefined || simulation.rollbackData === undefined) {
      throw new ConflictError(`Simulation "${id}" is LIVE but has no recorded liveAt/rollbackData`);
    }
    const deadlineMs =
      new Date(simulation.liveAt).getTime() + this.config.ROLLBACK_WINDOW_HOURS * 60 * 60 * 1000;
    if (this.now().getTime() > deadlineMs) {
      throw new ConflictError(
        `Rollback window (${this.config.ROLLBACK_WINDOW_HOURS}h after liveAt) has expired for simulation "${id}"`,
      );
    }

    await this.log(id, "INFO", "ROLLBACK_START", { correlationId });

    const accessToken = this.config.META_ACCESS_TOKEN;
    const pauseResult = await this.connector.pauseCampaign.execute({
      campaignId: simulation.rollbackData.newCampaignId,
      accessToken,
    });
    if (!pauseResult.ok) {
      await this.log(id, "ERROR", `Rollback: pause campaign gagal — ${pauseResult.error.message}`);
      throw pauseResult.error;
    }
    await this.log(
      id,
      "INFO",
      `Rollback: campaign ${simulation.rollbackData.newCampaignId} dipause.`,
    );

    for (const entry of simulation.rollbackData.mutatedEntities) {
      if (!entry.reversible || entry.targetType !== "ad") {
        continue;
      }
      const reactivateResult = await this.connector.activateAd.execute({
        adId: entry.targetId,
        accessToken,
      });
      if (!reactivateResult.ok) {
        await this.log(
          id,
          "ERROR",
          `Rollback: reactivate ad ${entry.targetId} gagal — ${reactivateResult.error.message}`,
        );
        continue;
      }
      await this.log(id, "INFO", `Rollback: ad ${entry.targetId} diaktifkan kembali.`);
    }

    const rolledBackAt = this.now().toISOString();
    await this.log(id, "INFO", "ROLLBACK_COMPLETE", { rolledBackAt });
    await this.repository.markRolledBack(id, rolledBackAt);
    return this.statusOf(id);
  }

  /** `GET /api/v1/simulation/live` — the `/go-live` dashboard page's real data source (coordinator note section 8). */
  async listLive(): Promise<readonly SimulationStatusResponseDto[]> {
    const simulations = await this.repository.listLive();
    return Promise.all(simulations.map((simulation) => this.toStatusDto(simulation)));
  }

  /**
   * `POST /api/v1/simulation/:id/pause` — the `/go-live` monitoring panel's `[⏸ Pause]` button.
   * Pauses the real created campaign via `PauseCampaign` WITHOUT rolling back — `status` stays
   * `'LIVE'` (a paused-but-still-live campaign is a real, valid Meta state; only a full
   * `.../rollback` also re-activates whatever else Go Live mutated and marks `'ROLLED_BACK'`).
   */
  async pauseLive(id: string, correlationId: string): Promise<SimulationStatusResponseDto> {
    const simulation = await this.findOrThrow(id);
    if (simulation.status !== "LIVE" || simulation.liveCampaignId === undefined) {
      throw new ConflictError(`Simulation "${id}" has no live campaign to pause`);
    }
    const result = await this.connector.pauseCampaign.execute({
      campaignId: simulation.liveCampaignId,
      accessToken: this.config.META_ACCESS_TOKEN,
    });
    if (!result.ok) {
      await this.log(id, "ERROR", `Pause (manual) gagal: ${result.error.message}`, {
        correlationId,
      });
      throw result.error;
    }
    await this.log(
      id,
      "INFO",
      `Campaign ${simulation.liveCampaignId} dipause secara manual dari monitoring panel.`,
      { correlationId },
    );
    return this.statusOf(id);
  }

  /**
   * A real click-to-WhatsApp image ad's `link_data.link` needs a real `https://wa.me/<number>`
   * destination — resolved from the branch's real `waba_configs.phone_number` row (the same table
   * `logJessyCheck` reads), never a placeholder. Throws `ValidationError` (fails the whole Go Live
   * before the ad is created, not silently) when no branch/config is found — a fabricated
   * `wa.me/` link with no number would be worse than a clear error.
   */
  private async resolveWaLink(id: string, simulation: StoredSimulation): Promise<string> {
    if (simulation.branch === undefined) {
      throw new ValidationError(
        "Cannot build an image ad's WhatsApp link: this simulation has no branch set",
      );
    }
    const configs = await this.wabaConfigRepository.listByTenant(simulation.tenantId);
    const branchConfig = configs.find((c) => c.branch_id === simulation.branch);
    if (branchConfig === undefined) {
      await this.log(
        id,
        "ERROR",
        `Tidak ada waba_configs untuk branch "${simulation.branch}" — tidak bisa membangun link WhatsApp untuk image ad.`,
      );
      throw new ValidationError(
        `No waba_configs row found for branch "${simulation.branch}" — cannot build a real WhatsApp link`,
      );
    }
    return `https://wa.me/${branchConfig.phone_number.replace(/[^\d]/g, "")}`;
  }

  private async logVerdictExecutionSkip(id: string): Promise<void> {
    await this.log(
      id,
      "WARN",
      "Eksekusi verdict Tamara (pause/fix/scale) DILEWATI: result.tamara.rekomendasi berupa teks bebas " +
        "(aksi/target/alasan/estimasi), bukan {verdict, targetId, targetType} terstruktur — tidak ada " +
        "cara aman untuk menjalankannya otomatis tanpa menerka target id. Ini SKIP yang jujur, bukan " +
        "eksekusi palsu.",
    );
  }

  /**
   * Honest status-check, not a fabricated toggle (coordinator note section 8): confirms whether a
   * `waba_configs` row for this simulation's branch exists with `status='ACTIVE'` — the real,
   * already-shipped Phase 1 gate — rather than flipping a switch that doesn't exist anywhere in
   * `packages/whatsapp-connector`/`apps/aaos-api`'s webhook handling (verified zero
   * `autoReply`/`auto_reply` matches).
   */
  private async logJessyCheck(
    id: string,
    simulation: StoredSimulation,
    dryRun: boolean,
  ): Promise<void> {
    const prefix = dryRun ? "[DRY RUN] " : "";
    try {
      const configs = await this.wabaConfigRepository.listByTenant(simulation.tenantId);
      const branchConfig =
        simulation.branch === undefined
          ? undefined
          : configs.find((c) => c.branch_id === simulation.branch);
      const active = branchConfig?.status === "ACTIVE";
      await this.log(
        id,
        active ? "INFO" : "WARN",
        `${prefix}Jessy status-check: waba_configs untuk branch "${simulation.branch ?? "(unset)"}" ` +
          (branchConfig === undefined
            ? "tidak ditemukan."
            : `status="${branchConfig.status}" (${active ? "aktif, Jessy akan merespons" : "TIDAK aktif"}).`) +
          " Ini pengecekan status nyata, bukan toggle — tidak ada gate on/off auto-reply lain di codebase ini.",
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      await this.log(id, "WARN", `${prefix}Jessy status-check gagal dibaca: ${message}.`);
    }
  }

  /**
   * Honest status-check, not a fabricated toggle: `packages/capi-connector` is real, substantial
   * infrastructure, but confirmed (coordinator note section 8) NOT composed anywhere in
   * `apps/aaos-api` — no `CAPI_CONNECTOR` DI token, no module importing
   * `CapiConnectorFactory.create`. There is nothing real to flip on/off yet, so this logs that
   * fact honestly instead of pretending an activation happened.
   */
  private async logCapiCheck(id: string, dryRun: boolean): Promise<void> {
    const prefix = dryRun ? "[DRY RUN] " : "";
    await this.log(
      id,
      "WARN",
      `${prefix}CAPI status-check: @aos/capi-connector belum di-compose di apps/aaos-api (tidak ada ` +
        "modul yang memanggil CapiConnectorFactory.create) — tidak ada toggle nyata untuk diaktifkan " +
        "pada langkah ini; dicatat sebagai audit log, bukan aktivasi palsu.",
    );
  }

  private async statusOf(id: string): Promise<SimulationStatusResponseDto> {
    const simulation = await this.findOrThrow(id);
    return this.toStatusDto(simulation);
  }

  private async toStatusDto(simulation: StoredSimulation): Promise<SimulationStatusResponseDto> {
    const logs = await this.repository.listLogs(simulation.id);
    return toSimulationStatusResponseDto(simulation, logs);
  }

  private async findOrThrow(id: string): Promise<StoredSimulation> {
    const simulation = await this.repository.findById(id);
    if (simulation === undefined) {
      throw new NotFoundError(`No simulation found with id "${id}"`);
    }
    return simulation;
  }

  private async log(
    id: string,
    level: "INFO" | "WARN" | "ERROR",
    message: string,
    payload?: SimulationLogPayload,
  ): Promise<void> {
    try {
      await this.repository.appendLog(id, {
        step: GO_LIVE_STEP,
        level,
        message,
        ...(payload !== undefined ? { payload } : {}),
        createdAt: this.now().toISOString(),
      });
    } catch (caught) {
      this.logger.warn(`GoLiveService.log failed for ${id}: ${String(caught)}`);
    }
  }
}

/** Start of the caller's real wall-clock day, ISO-formatted — used by the "max 1 Go Live per day" guard. */
function startOfTodayIso(now: Date): string {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

/** Reads `objectiveSnapshot.budget` as a positive finite number, or `undefined` when it isn't one — never a fabricated fallback. */
function readObjectiveBudgetCap(objectiveSnapshot: Record<string, unknown>): number | undefined {
  const raw = objectiveSnapshot.budget;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
    return undefined;
  }
  return raw / 30;
}
