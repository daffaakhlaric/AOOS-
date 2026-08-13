import type { Result } from "@aos/common";

import type { CampaignAttribution } from "../domain/entities/CampaignAttribution.js";
import type { AttributionError } from "../domain/errors/AttributionError.js";

import type { ClosingDataset } from "./IClosingAggregator.js";

/** Contract for `AttributionEngineService` — implements the three attribution methods (Direct/Time-based/Branch-based) over a `ClosingDataset`. */
export interface IAttributionEngine {
  attribute(
    dataset: ClosingDataset,
  ): Promise<Result<ReadonlyArray<CampaignAttribution>, AttributionError>>;
}
