import { Injectable, Logger } from "@nestjs/common";

import { resolveBenchmark } from "../metric-snapshot/domain/benchmark.js";
import { detectSignals } from "../metric-snapshot/domain/signal-engine.js";
import { MetricSnapshotService } from "../metric-snapshot/metric-snapshot.service.js";

import { assessCampaignHealth } from "./domain/campaign-health.js";
import type { CampaignHealth } from "./domain/campaign-health.js";
import { decideNextAction } from "./domain/decision.js";
import type { SamanthaDecision } from "./domain/decision.js";
import { diagnoseCampaign } from "./domain/diagnosis.js";
import type { CampaignDiagnosis } from "./domain/diagnosis.js";
import {
  toCampaignHealthResponseDto,
  type CampaignHealthResponseDto,
} from "./dto/campaign-health-response.dto.js";
import {
  CampaignAssessmentRepository,
  type StoredAssessment,
} from "./infrastructure/campaign-assessment.repository.js";

interface ComputedAssessment {
  readonly health: CampaignHealth;
  readonly diagnosis: CampaignDiagnosis;
  readonly decision: SamanthaDecision;
}

/**
 * `modules/campaign-health` (EYVRA — SAMANTHA V2 Phase 3 + Phase 4 + Phase 6). Orchestrates real
 * calls into the already-shipped Phase 1/2 building blocks — `MetricSnapshotService` for the real
 * `last_7_days`/`previous_7_days`/`lifetime` snapshots, `resolveBenchmark`/`detectSignals` (pure
 * domain functions) over them — then `assessCampaignHealth` -> `diagnoseCampaign` ->
 * `decideNextAction` (Phase 4, also pure, no I/O of its own — see `domain/decision.ts`'s header
 * doc for why it only ever returns a recommendation, never executes one).
 *
 * Phase 6 adds a persistence + history capability on top of that SAME computation, unchanged:
 * `assess()` (the original, still non-persisting `GET /:campaignId` path) and `assessAndRecord()`
 * (the new, persisting `POST /:campaignId/assess` path) both call the same private `compute()`
 * helper — no duplicated orchestration — `assessAndRecord()` additionally writes the result via
 * `CampaignAssessmentRepository.record`, best-effort (see that call site's own comment for why a
 * persistence failure must never turn an otherwise-successful assessment into a failed HTTP
 * request, same "a logging failure must never fail the real action it describes" discipline
 * `AuditLogService.record`'s own class doc establishes).
 */
@Injectable()
export class CampaignHealthService {
  private readonly logger = new Logger(CampaignHealthService.name);

  constructor(
    private readonly metricSnapshotService: MetricSnapshotService,
    private readonly repository: CampaignAssessmentRepository,
  ) {}

  /** Purely computed-on-demand, non-persisting — for a quick check without cluttering history. See `assessAndRecord`'s own doc for why a second, persisting shape exists instead of merging both into one endpoint with a query flag. */
  async assess(tenantId: string, metaCampaignId: string): Promise<CampaignHealthResponseDto> {
    const { health, diagnosis, decision } = await this.compute(tenantId, metaCampaignId);
    return toCampaignHealthResponseDto(metaCampaignId, health, diagnosis, decision);
  }

  /**
   * The SAME computation `assess()` runs, plus a real, persisted `samantha_campaign_assessments`
   * row — for a caller that wants this specific assessment to become part of the campaign's
   * durable history (e.g. a manual "record this checkpoint" action), distinct from `assess()`'s
   * quick, throwaway check. `repository.record` is best-effort: a Supabase write failure is logged
   * and swallowed, never rethrown, so a persistence outage never turns an otherwise-successful
   * assessment computation into a failed HTTP request.
   */
  async assessAndRecord(
    tenantId: string,
    metaCampaignId: string,
  ): Promise<CampaignHealthResponseDto> {
    const { health, diagnosis, decision } = await this.compute(tenantId, metaCampaignId);

    try {
      await this.repository.record(tenantId, metaCampaignId, health, diagnosis, decision);
    } catch (caught) {
      this.logger.warn(
        `CampaignHealthService.assessAndRecord(${metaCampaignId}) — persisting the assessment failed, returning the computed result anyway: ${String(caught)}`,
      );
    }

    return toCampaignHealthResponseDto(metaCampaignId, health, diagnosis, decision);
  }

  /** Thin pass-through to `CampaignAssessmentRepository.listHistory` — `limit` is already validated/capped at the controller's Zod boundary before it reaches here. */
  async history(
    tenantId: string,
    metaCampaignId: string,
    limit: number,
  ): Promise<readonly StoredAssessment[]> {
    return this.repository.listHistory(tenantId, metaCampaignId, limit);
  }

  private async compute(tenantId: string, metaCampaignId: string): Promise<ComputedAssessment> {
    const [current, previous, campaignLifetime, accountLifetime] = await Promise.all([
      this.metricSnapshotService.getCampaignSnapshot(tenantId, metaCampaignId, "last_7_days"),
      this.metricSnapshotService.getCampaignSnapshot(tenantId, metaCampaignId, "previous_7_days"),
      this.metricSnapshotService.getCampaignSnapshot(tenantId, metaCampaignId, "lifetime"),
      this.metricSnapshotService.getAccountSnapshot(tenantId, "lifetime"),
    ]);

    const benchmark = resolveBenchmark(
      { tenantId, campaignId: metaCampaignId },
      { campaignHistorical: campaignLifetime, accountHistorical: accountLifetime },
    );

    // A genuinely empty previous window makes a trend computation meaningless — honest
    // `undefined` in that case, matching `signal-engine.ts`'s own tolerance for `undefined`
    // trend inputs (see `detectCreativeFatigue`/`relativeDelta`).
    const ctrTrendForFatigue =
      previous.daysCovered > 0 &&
      previous.ctr !== undefined &&
      previous.ctr !== 0 &&
      current.ctr !== undefined
        ? (current.ctr - previous.ctr) / previous.ctr
        : undefined;
    const frequencyDataAvailable = current.frequency !== undefined;

    const signals = detectSignals({
      current,
      previous,
      dataSufficiency: current.dataSufficiency,
      frequencyForFatigue: current.frequency,
      ctrTrendForFatigue,
    });

    const health = assessCampaignHealth({
      current,
      signals,
      benchmark,
      frequencyDataAvailable,
    });
    const diagnosis = diagnoseCampaign(health, signals);
    const decision = decideNextAction(health, diagnosis);

    return { health, diagnosis, decision };
  }
}
