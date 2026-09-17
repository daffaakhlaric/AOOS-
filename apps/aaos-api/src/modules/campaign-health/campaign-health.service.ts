import { Injectable } from "@nestjs/common";

import { resolveBenchmark } from "../metric-snapshot/domain/benchmark.js";
import { detectSignals } from "../metric-snapshot/domain/signal-engine.js";
import { MetricSnapshotService } from "../metric-snapshot/metric-snapshot.service.js";

import { assessCampaignHealth } from "./domain/campaign-health.js";
import { diagnoseCampaign } from "./domain/diagnosis.js";
import {
  toCampaignHealthResponseDto,
  type CampaignHealthResponseDto,
} from "./dto/campaign-health-response.dto.js";

/**
 * `modules/campaign-health` (EYVRA — SAMANTHA V2 Phase 3). Orchestrates real calls into the
 * already-shipped Phase 1/2 building blocks — `MetricSnapshotService` for the real `last_7_days`/
 * `previous_7_days`/`lifetime` snapshots, `resolveBenchmark`/`detectSignals` (pure domain
 * functions) over them — then `assessCampaignHealth` -> `diagnoseCampaign` (also pure, no I/O of
 * their own). This module has ZERO I/O of its own beyond what `MetricSnapshotService` already
 * provides — no new repository, no new table.
 */
@Injectable()
export class CampaignHealthService {
  constructor(private readonly metricSnapshotService: MetricSnapshotService) {}

  async assess(tenantId: string, metaCampaignId: string): Promise<CampaignHealthResponseDto> {
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

    return toCampaignHealthResponseDto(metaCampaignId, health, diagnosis);
  }
}
