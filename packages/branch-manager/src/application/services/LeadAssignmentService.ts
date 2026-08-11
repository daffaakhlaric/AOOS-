import { err, ok, type Result } from "@aos/common";
import type { ValidationError } from "@aos/errors";

import { LeadAssignmentBuilder } from "../../builders/LeadAssignmentBuilder.js";
import type { IAssignmentStrategy } from "../../contracts/IAssignmentStrategy.js";
import type { IBranchRegistry } from "../../contracts/IBranchRegistry.js";
import type { ISalesTeamRegistry } from "../../contracts/ISalesTeamRegistry.js";
import type { LeadAssignment } from "../../domain/entities/LeadAssignment.js";
import type {
  AssignmentError,
  BranchNotFoundError,
  SalesHumanNotFoundError,
} from "../../domain/errors/index.js";
import type { BranchManagerEvents } from "../../domain/events/BranchManagerEvents.js";
import type { LeadQueuedReason } from "../../domain/events/LeadQueued.js";
import type { AssignmentMode } from "../../domain/value-objects/AssignmentMode.js";
import type { BranchId } from "../../domain/value-objects/BranchId.js";

import type { QueueService } from "./QueueService.js";

export interface AssignLeadInput {
  readonly leadId: string;
  readonly branchId: BranchId;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly tenantId: string;
  readonly correlationId: string;
}

export type AssignLeadOutcome =
  | { readonly status: "ASSIGNED"; readonly assignment: LeadAssignment }
  | { readonly status: "QUEUED"; readonly queuePosition: number };

export type AssignLeadError =
  BranchNotFoundError | AssignmentError | ValidationError | SalesHumanNotFoundError;

/**
 * Orchestrates lead assignment (Application Service): resolves the target branch's
 * `assignmentMode` to the matching `IAssignmentStrategy` (real Strategy-pattern dispatch via a
 * `Record<AssignmentMode, IAssignmentStrategy>`, never an if/else chain), applies its selection,
 * and either records a `LeadAssignment` + increments the assigned `SalesHuman`'s counters, or
 * falls back to `QueueService.enqueue` — publishing the matching event either way.
 */
export class LeadAssignmentService {
  constructor(
    private readonly branchRegistry: IBranchRegistry,
    private readonly salesTeamRegistry: ISalesTeamRegistry,
    private readonly strategies: Readonly<Record<AssignmentMode, IAssignmentStrategy>>,
    private readonly queueService: QueueService,
    private readonly events: BranchManagerEvents,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async assign(input: AssignLeadInput): Promise<Result<AssignLeadOutcome, AssignLeadError>> {
    const branchResult = this.branchRegistry.getByBranchId(input.branchId);
    if (!branchResult.ok) {
      return err(branchResult.error);
    }
    const branchConfig = branchResult.value;
    const strategy = this.strategies[branchConfig.assignmentMode];

    const sales = this.salesTeamRegistry.getByBranch(input.branchId);
    const selection = strategy.select(input.branchId, sales);

    if (!selection.ok) {
      return this.enqueueAndPublish(input, "NO_AVAILABLE_SALES");
    }
    if (selection.value.kind === "PENDING") {
      return this.enqueueAndPublish(input, "MANUAL");
    }

    const salesHuman = selection.value.salesHuman;
    const assignmentResult = new LeadAssignmentBuilder()
      .withLeadId(input.leadId)
      .withBranchId(input.branchId)
      .withSalesHumanId(salesHuman.id)
      .withAssignedAt(this.now())
      .withAssignmentMode(branchConfig.assignmentMode)
      .withMetadata(input.metadata ?? {})
      .build();
    if (!assignmentResult.ok) {
      return err(assignmentResult.error);
    }

    const updated = salesHuman.withIncrementedLeadCounts(this.now());
    const updateResult = this.salesTeamRegistry.update(updated);
    /* v8 ignore start -- `salesHuman` was just read from this same registry via `getByBranch`
       above, with no intervening await/yield point that could let it be concurrently removed
       (this method runs single-threaded to this point), so `update` cannot fail here. */
    if (!updateResult.ok) {
      return err(updateResult.error);
    }
    /* v8 ignore stop */

    await this.events.publishLeadAssigned({
      assignmentId: assignmentResult.value.id.toString(),
      leadId: input.leadId,
      branchId: input.branchId,
      salesHumanId: salesHuman.id.toString(),
      assignmentMode: branchConfig.assignmentMode,
      tenantId: input.tenantId,
      correlationId: input.correlationId,
      occurredAt: this.now(),
      version: "1.0",
    });

    return ok({ status: "ASSIGNED", assignment: assignmentResult.value });
  }

  private async enqueueAndPublish(
    input: AssignLeadInput,
    reason: LeadQueuedReason,
  ): Promise<Result<AssignLeadOutcome, AssignmentError | ValidationError>> {
    const enqueueResult = this.queueService.enqueue({
      leadId: input.leadId,
      branchId: input.branchId,
      metadata: input.metadata,
    });
    if (!enqueueResult.ok) {
      return err(enqueueResult.error);
    }
    const queuePosition = this.queueService.getQueueSize(input.branchId);
    await this.events.publishLeadQueued({
      leadId: input.leadId,
      branchId: input.branchId,
      reason,
      queuePosition,
      tenantId: input.tenantId,
      correlationId: input.correlationId,
      occurredAt: this.now(),
      version: "1.0",
    });
    return ok({ status: "QUEUED", queuePosition });
  }
}
