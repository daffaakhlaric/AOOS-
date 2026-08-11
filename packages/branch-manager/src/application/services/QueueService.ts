import { err, ok, type Result } from "@aos/common";
import type { ValidationError } from "@aos/errors";
import type { Logger } from "@aos/logger";

import {
  AssignmentQueue,
  createQueuedLead,
  type QueuedLead,
} from "../../domain/entities/AssignmentQueue.js";
import { AssignmentError } from "../../domain/errors/index.js";
import type { BranchManagerEvents } from "../../domain/events/BranchManagerEvents.js";
import type { BranchId } from "../../domain/value-objects/BranchId.js";

import type { LeadAssignmentService } from "./LeadAssignmentService.js";

export interface QueueEnqueueInput {
  readonly leadId: string;
  readonly branchId: BranchId;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface QueueFlushContext {
  readonly tenantId: string;
  readonly correlationId: string;
}

export interface QueueFlushResult {
  readonly assigned: number;
  readonly remaining: number;
}

/**
 * Orchestrates the per-branch FIFO wait-list (Application Service). Owns `maxQueueSize`
 * enforcement and `queueTtlMs` expiry (both delegated to the immutable `AssignmentQueue` entity),
 * via an injectable clock — never a raw `Date.now()` call scattered through the logic.
 *
 * `flushBranch` calls back into `LeadAssignmentService` (per this package's explicit design
 * guidance) to re-attempt assignment for dequeued leads. That creates a two-way dependency
 * between the two services (`LeadAssignmentService.assign` also calls `QueueService.enqueue` on a
 * failed/pending strategy outcome) — resolved with setter injection: `QueueService` is
 * constructed first, `LeadAssignmentService` is constructed with a normal constructor reference to
 * it, and `attachAssignmentService` closes the loop once both exist. See
 * `factories/BranchManagerFactory.ts` for the wiring order.
 */
export class QueueService {
  private readonly maxQueueSize: number;
  private readonly queues = new Map<BranchId, AssignmentQueue>();
  private assignmentService: LeadAssignmentService | undefined;

  constructor(
    maxQueueSize: number,
    private readonly queueTtlMs: number,
    private readonly events: BranchManagerEvents,
    private readonly logger: Logger,
    private readonly now: () => Date = () => new Date(),
  ) {
    // Defensive clamp: guarantees every `AssignmentQueue.create` call below always succeeds,
    // regardless of what a caller passes for `maxQueueSize` (e.g. a misconfigured 0 or negative).
    this.maxQueueSize = Math.max(1, Math.floor(maxQueueSize));
  }

  /** Setter injection closing the `QueueService` <-> `LeadAssignmentService` cycle — called exactly once by `BranchManagerFactory`. */
  attachAssignmentService(service: LeadAssignmentService): void {
    this.assignmentService = service;
  }

  enqueue(input: QueueEnqueueInput): Result<QueuedLead, ValidationError | AssignmentError> {
    this.pruneExpired(input.branchId);
    const leadResult = createQueuedLead({
      leadId: input.leadId,
      branchId: input.branchId,
      enqueuedAt: this.now(),
      metadata: input.metadata,
    });
    if (!leadResult.ok) {
      return err(leadResult.error);
    }
    const queue = this.getOrCreateQueue(input.branchId);
    const enqueueResult = queue.enqueue(leadResult.value);
    if (!enqueueResult.ok) {
      this.logger.warn(
        { branchId: input.branchId, maxQueueSize: this.maxQueueSize },
        "branch-manager: queue is full, lead rejected",
      );
      return err(enqueueResult.error);
    }
    this.queues.set(input.branchId, enqueueResult.value);
    return ok(leadResult.value);
  }

  dequeue(branchId: BranchId): QueuedLead | undefined {
    this.pruneExpired(branchId);
    const queue = this.queues.get(branchId);
    if (queue === undefined) {
      return undefined;
    }
    const { queue: next, lead } = queue.dequeue();
    this.queues.set(branchId, next);
    return lead;
  }

  getQueueSize(branchId: BranchId): number {
    this.pruneExpired(branchId);
    return this.queues.get(branchId)?.size ?? 0;
  }

  getBranchQueue(branchId: BranchId): readonly QueuedLead[] {
    this.pruneExpired(branchId);
    return this.queues.get(branchId)?.peekAll() ?? [];
  }

  getAll(): ReadonlyMap<BranchId, readonly QueuedLead[]> {
    const result = new Map<BranchId, readonly QueuedLead[]>();
    for (const branchId of this.queues.keys()) {
      result.set(branchId, this.getBranchQueue(branchId));
    }
    return result;
  }

  /**
   * Dequeues up to `capacity` leads (FIFO) and re-attempts assignment for each via
   * `LeadAssignmentService.assign`, then publishes `QueueFlushed` with the pinned
   * `{ assigned, remaining }` shape. `capacity` is caller-supplied (typically computed by
   * `FlushQueue`/`UpdateSalesStatus` from the branch's currently-available sales capacity), not
   * recomputed internally — matching the spec's pinned `queue_flush` example directly.
   */
  async flushBranch(
    branchId: BranchId,
    capacity: number,
    context: QueueFlushContext,
  ): Promise<Result<QueueFlushResult, AssignmentError>> {
    this.pruneExpired(branchId);
    if (this.assignmentService === undefined) {
      return err(
        new AssignmentError(
          "QueueService.flushBranch called before attachAssignmentService wired the assignment service",
        ),
      );
    }

    let assigned = 0;
    const attempts = Math.max(0, Math.floor(capacity));
    for (let i = 0; i < attempts; i += 1) {
      const lead = this.dequeue(branchId);
      if (lead === undefined) {
        break;
      }
      const result = await this.assignmentService.assign({
        leadId: lead.leadId,
        branchId,
        metadata: lead.metadata,
        tenantId: context.tenantId,
        correlationId: context.correlationId,
      });
      if (result.ok && result.value.status === "ASSIGNED") {
        assigned += 1;
      }
      // A `QUEUED` outcome (e.g. a `MANUAL`-mode branch, or a stale capacity estimate) means the
      // lead was already re-enqueued by `LeadAssignmentService.assign` itself — nothing further to
      // do here. An `err` outcome (branch no longer registered) is not retried; the lead is
      // dropped from tracking, a defensive corner case that should not occur for a lead whose
      // `branchId` is this very queue's own key.
    }

    const remaining = this.getQueueSize(branchId);
    this.logger.info({ branchId, assigned, remaining }, "branch-manager: queue flushed");
    await this.events.publishQueueFlushed({
      branchId,
      assigned,
      remaining,
      tenantId: context.tenantId,
      correlationId: context.correlationId,
      occurredAt: this.now(),
      version: "1.0",
    });
    return ok({ assigned, remaining });
  }

  private getOrCreateQueue(branchId: BranchId): AssignmentQueue {
    const existing = this.queues.get(branchId);
    if (existing !== undefined) {
      return existing;
    }
    const result = AssignmentQueue.create(branchId, this.maxQueueSize);
    /* v8 ignore start -- `this.maxQueueSize` is defensively clamped to a positive integer in the
       constructor above, so `AssignmentQueue.create` (which only rejects a non-positive
       `maxSize`) cannot fail here. */
    if (!result.ok) {
      throw new Error("unreachable: maxQueueSize is always a clamped positive integer");
    }
    /* v8 ignore stop */
    this.queues.set(branchId, result.value);
    return result.value;
  }

  private pruneExpired(branchId: BranchId): void {
    const queue = this.queues.get(branchId);
    if (queue === undefined) {
      return;
    }
    const { queue: pruned } = queue.removeExpired(this.now(), this.queueTtlMs);
    this.queues.set(branchId, pruned);
  }
}
