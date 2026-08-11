import { err, ok, type Result } from "@aos/common";

import type { IAvailabilityTracker } from "../../contracts/IAvailabilityTracker.js";
import type { ISalesTeamRegistry } from "../../contracts/ISalesTeamRegistry.js";
import type { SalesHuman } from "../../domain/entities/SalesHuman.js";
import type { SalesHumanNotFoundError } from "../../domain/errors/index.js";
import type { BranchManagerEvents } from "../../domain/events/BranchManagerEvents.js";
import type { SalesHumanId } from "../../domain/value-objects/SalesHumanId.js";
import type { SalesStatus } from "../../domain/value-objects/SalesStatus.js";

/**
 * Owns sales-availability tracking (Application Service): status transitions (publishing
 * `SalesStatusChanged`) and daily-quota-reset semantics.
 *
 * Judgment call — daily-reset scope: a real production system would reset `todayLeadCount` to 0
 * at midnight per branch/tenant timezone via a scheduler. This package has no scheduler
 * dependency (in-memory, no persistence, no cron per the AOS constitution's scope for this
 * package), so `resetDailyCounts()` is implemented as a plain callable method — exercising it is
 * the responsibility of whatever future orchestration layer (a cron job, a queue worker) owns
 * wall-clock timing. No internal timer is started by this class.
 */
export class AvailabilityService implements IAvailabilityTracker {
  constructor(
    private readonly salesTeamRegistry: ISalesTeamRegistry,
    private readonly events: BranchManagerEvents,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async updateStatus(
    id: SalesHumanId,
    status: SalesStatus,
    context: { readonly tenantId: string; readonly correlationId: string },
  ): Promise<Result<SalesHuman, SalesHumanNotFoundError>> {
    const existingResult = this.salesTeamRegistry.getById(id);
    if (!existingResult.ok) {
      return err(existingResult.error);
    }
    const previousStatus = existingResult.value.status;
    const updated = existingResult.value.withStatus(status, this.now());
    const updateResult = this.salesTeamRegistry.update(updated);
    /* v8 ignore start -- `id` was just confirmed present by `getById` above, with no intervening
       await/yield point that could allow concurrent removal (single-threaded to this point), so
       `update` cannot fail here. */
    if (!updateResult.ok) {
      return err(updateResult.error);
    }
    /* v8 ignore stop */

    await this.events.publishSalesStatusChanged({
      salesHumanId: id.toString(),
      branchId: updated.branchId,
      previousStatus,
      newStatus: status,
      tenantId: context.tenantId,
      correlationId: context.correlationId,
      occurredAt: this.now(),
      version: "1.0",
    });

    return ok(updateResult.value);
  }

  resetDailyCounts(): void {
    for (const salesHuman of this.salesTeamRegistry.getAll()) {
      this.salesTeamRegistry.update(salesHuman.withResetDailyCount());
    }
  }
}
