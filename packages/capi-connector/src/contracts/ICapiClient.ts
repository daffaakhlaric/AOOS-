import type { Result } from "@aos/common";

import type { CapiConnectorConfig } from "../config/CapiConnectorConfig.js";
import type { CapiBatch } from "../domain/entities/CapiBatch.js";
import type { EmqReport } from "../domain/entities/EmqReport.js";
import type { CapiApiError } from "../domain/errors/CapiApiError.js";

export interface SendEventsResult {
  readonly eventsReceived: number;
  readonly fbtraceId?: string;
  readonly messages?: readonly string[];
}

/** Port over Meta's Conversions API (`graph.facebook.com/{v}/{pixel-id}/events`) — `MetaCapiClient` is the only production adapter. */
export interface ICapiClient {
  sendEvents(
    batch: CapiBatch,
    config: CapiConnectorConfig,
  ): Promise<Result<SendEventsResult, CapiApiError>>;
  getEmqScore(config: CapiConnectorConfig): Promise<Result<EmqReport, CapiApiError>>;
}
