import { ok, type Result } from "@aos/common";

import type { CapiConnectorConfig } from "../../config/CapiConnectorConfig.js";
import type { ICapiClient } from "../../contracts/ICapiClient.js";
import type { EmqReport } from "../../domain/entities/EmqReport.js";
import type { CapiApiError } from "../../domain/errors/CapiApiError.js";
import type { CapiConnectorEvents } from "../../domain/events/CapiConnectorEvents.js";

export interface GetEmqScoreInput {
  readonly correlationId: string;
}

/** Fetches the pixel's current Event Match Quality report from Meta CAPI diagnostics and publishes `EmqScoreReceived`. */
export class GetEmqScore {
  constructor(
    private readonly client: ICapiClient,
    private readonly config: CapiConnectorConfig,
    private readonly events: CapiConnectorEvents,
  ) {}

  async execute(input: GetEmqScoreInput): Promise<Result<EmqReport, CapiApiError>> {
    const result = await this.client.getEmqScore(this.config);
    if (!result.ok) {
      return result;
    }
    await this.events.publishEmqScoreReceived({
      pixelId: result.value.pixelId,
      score: result.value.score.value,
      eventsReceived: result.value.eventsReceived,
      tenantId: this.config.tenantId,
      correlationId: input.correlationId,
      occurredAt: result.value.capturedAt,
      version: "1.0",
    });
    return ok(result.value);
  }
}
