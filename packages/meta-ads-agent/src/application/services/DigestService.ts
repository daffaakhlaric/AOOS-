import { err, ok, type Result } from "@aos/common";

import {
  DailyDigestBuilder,
  type DailyDigestBuildInput,
} from "../../builders/DailyDigestBuilder.js";
import type { DailyDigest } from "../../domain/entities/DailyDigest.js";
import type { DecisionError } from "../../domain/errors/index.js";
import type { MetaAdsAgentEvents } from "../../domain/events/MetaAdsAgentEvents.js";

/** Generates and publishes the plain-Indonesian `DailyDigest` for one cycle. */
export class DigestService {
  constructor(private readonly events: MetaAdsAgentEvents) {}

  async generate(
    input: DailyDigestBuildInput,
    correlationId: string,
  ): Promise<Result<DailyDigest, DecisionError>> {
    const digestResult = DailyDigestBuilder.build(input);
    if (!digestResult.ok) {
      return err(digestResult.error);
    }
    await this.events.publishDigestGenerated({
      tenantId: input.tenantId,
      date: input.date,
      currentHotLeads: digestResult.value.currentHotLeads,
      targetHotLeads: digestResult.value.targetHotLeads,
      correlationId,
      occurredAt: new Date(),
      version: "1.0",
    });
    return ok(digestResult.value);
  }
}
