import type { Result } from "@aos/common";

import type { SalesHuman } from "../../domain/entities/SalesHuman.js";
import type { SalesHumanNotFoundError } from "../../domain/errors/index.js";
import type { SalesHumanId } from "../../domain/value-objects/SalesHumanId.js";
import { SalesStatus } from "../../domain/value-objects/SalesStatus.js";
import type { AvailabilityService } from "../services/AvailabilityService.js";

import type { FlushQueue } from "./FlushQueue.js";

export interface UpdateSalesStatusInput {
  readonly salesHumanId: SalesHumanId;
  readonly status: SalesStatus;
  readonly tenantId: string;
  readonly correlationId: string;
}

/**
 * Transitions a sales human's status (`ON | BUSY | OFF`) and, when the new status is `ON`,
 * auto-triggers `FlushQueue` for their branch — freed capacity should immediately drain the
 * queue rather than waiting for a separate manual `FlushQueue` call. Any other transition
 * (`ON → BUSY`, `ON → OFF`, `BUSY → OFF`, etc.) only publishes `SalesStatusChanged`; it can only
 * ever reduce capacity, never free it, so no flush is attempted.
 */
export class UpdateSalesStatus {
  constructor(
    private readonly availabilityService: AvailabilityService,
    private readonly flushQueue: FlushQueue,
  ) {}

  async execute(
    input: UpdateSalesStatusInput,
  ): Promise<Result<SalesHuman, SalesHumanNotFoundError>> {
    const result = await this.availabilityService.updateStatus(input.salesHumanId, input.status, {
      tenantId: input.tenantId,
      correlationId: input.correlationId,
    });
    if (!result.ok) {
      return result;
    }
    if (input.status === SalesStatus.ON) {
      await this.flushQueue.execute({
        branchId: result.value.branchId,
        tenantId: input.tenantId,
        correlationId: input.correlationId,
      });
    }
    return result;
  }
}
