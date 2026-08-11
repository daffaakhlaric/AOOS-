import type { Result } from "@aos/common";

import type { SalesHuman } from "../domain/entities/SalesHuman.js";
import type { SalesHumanNotFoundError } from "../domain/errors/index.js";
import type { SalesHumanId } from "../domain/value-objects/SalesHumanId.js";
import type { SalesStatus } from "../domain/value-objects/SalesStatus.js";

/** Port for sales-availability tracking — implemented by `AvailabilityService`. */
export interface IAvailabilityTracker {
  updateStatus(
    id: SalesHumanId,
    status: SalesStatus,
    context: { readonly tenantId: string; readonly correlationId: string },
  ): Promise<Result<SalesHuman, SalesHumanNotFoundError>>;
  /** Resets `todayLeadCount` to 0 for every registered sales human — callable by whatever future orchestration layer owns the daily-reset schedule (this package has no internal timer, per its in-memory/no-scheduler-dependency scope). */
  resetDailyCounts(): void;
}
