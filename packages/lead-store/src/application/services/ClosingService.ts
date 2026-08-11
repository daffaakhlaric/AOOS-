import type { Result } from "@aos/common";

import type { Closing } from "../../domain/entities/Closing.js";
import type { LeadStoreError } from "../../domain/errors/LeadStoreError.js";
import type { ClosingStats } from "../../types/LeadStoreTypes.js";
import type { GetClosingStats, GetClosingStatsInput } from "../use-cases/GetClosingStats.js";
import type { RecordClosing, RecordClosingInput } from "../use-cases/RecordClosing.js";

/** Facade over closing use cases — the composition `LeadStoreFactory` wires as `ClosingService`. */
export class ClosingService {
  constructor(
    private readonly recordClosing: RecordClosing,
    private readonly getClosingStats: GetClosingStats,
  ) {}

  record(input: RecordClosingInput): Promise<Result<Closing, LeadStoreError>> {
    return this.recordClosing.execute(input);
  }

  stats(input: GetClosingStatsInput): Promise<Result<ClosingStats, LeadStoreError>> {
    return this.getClosingStats.execute(input);
  }
}
