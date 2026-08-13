import { err, ok, type Result } from "@aos/common";

import type { IReportGenerator } from "../../contracts/IReportGenerator.js";
import type { ClosingTrackerError } from "../../domain/errors/ClosingTrackerError.js";
import type { ClosingTrackerEvents } from "../../domain/events/ClosingTrackerEvents.js";
import type { ReportPeriod } from "../../domain/value-objects/ReportPeriod.js";
import type { TamaraFeedService, TamaraFeedData } from "../services/TamaraFeedService.js";

export interface FeedToTamaraInput {
  readonly period: ReportPeriod;
  readonly targetSpk: number;
  readonly tenantId: string;
  readonly correlationId: string;
}

/** Pushes attribution/campaign-signal data to Tamara (`@aos/meta-ads-agent`) (spec: "FeedToTamara ← push attribution to meta-ads-agent"). Emits one `CampaignAttributed` event per campaign signal. */
export class FeedToTamara {
  constructor(
    private readonly reportGenerator: IReportGenerator,
    private readonly tamaraFeedService: TamaraFeedService,
    private readonly events: ClosingTrackerEvents,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: FeedToTamaraInput): Promise<Result<TamaraFeedData, ClosingTrackerError>> {
    const result = await this.reportGenerator.generate(input.period);
    if (!result.ok) {
      return err(result.error);
    }
    const report = result.value;
    const feed = this.tamaraFeedService.build(report, input.targetSpk);
    const occurredAt = this.now();

    for (const signal of feed.campaignSignals) {
      const attribution = report.campaignAttributions.find(
        (a) => a.campaignId === signal.campaignId,
      );
      await this.events.publishCampaignAttributed({
        campaignId: signal.campaignId,
        branch: attribution?.branch ?? "UNKNOWN",
        method:
          signal.confidence === 100
            ? "DIRECT"
            : signal.confidence === 70
              ? "TIME_BASED"
              : "BRANCH_BASED",
        confidence: signal.confidence,
        rphSpk: signal.rphSpk,
        verdict: signal.verdict,
        tenantId: input.tenantId,
        correlationId: input.correlationId,
        occurredAt,
        version: "1.0",
      });
    }

    return ok(feed);
  }
}
