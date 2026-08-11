import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import { z } from "zod";

import { AssignmentError } from "../errors/index.js";
import { BranchId } from "../value-objects/BranchId.js";

/**
 * Judgment call: the spec references `QueuedLead` (`QueueService.dequeue(): QueuedLead |
 * undefined`, and in the queue-flush event example) but never gives it an explicit home in the
 * folder tree. Placed here, alongside `AssignmentQueue` (the queue entity), as its own element
 * type — a Zod-validated shape, per this package's "all inputs validated with Zod" architecture
 * rule.
 */
export const QueuedLeadSchema = z.object({
  leadId: z.string().min(1),
  branchId: z.nativeEnum(BranchId),
  enqueuedAt: z.date(),
  metadata: z.record(z.unknown()).optional(),
});

export type QueuedLead = z.infer<typeof QueuedLeadSchema>;

/** Validates a raw candidate into a `QueuedLead`, failing fast with `Result.err` rather than throwing. */
export function createQueuedLead(input: unknown): Result<QueuedLead, ValidationError> {
  const parsed = QueuedLeadSchema.safeParse(input);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    return err(new ValidationError(`QueuedLead validation failed: ${details}`));
  }
  return ok(parsed.data);
}

/**
 * A single branch's FIFO wait-list of leads that couldn't be assigned immediately (every sales
 * human was unavailable, or the branch's mode is `MANUAL`). Immutable: `enqueue`/`dequeue`/
 * `removeExpired` all return a new instance — `QueueService` is the mutable caretaker that tracks
 * "the current instance per branch" in its own `Map`.
 */
export class AssignmentQueue {
  private constructor(
    private readonly branchId: BranchId,
    private readonly maxSize: number,
    private readonly items: readonly QueuedLead[],
  ) {}

  static create(branchId: BranchId, maxSize: number): Result<AssignmentQueue, ValidationError> {
    if (typeof maxSize !== "number" || !Number.isInteger(maxSize) || maxSize <= 0) {
      return err(
        new ValidationError(
          `AssignmentQueue.maxSize must be a positive integer, received: ${String(maxSize)}`,
        ),
      );
    }
    return ok(new AssignmentQueue(branchId, maxSize, []));
  }

  get size(): number {
    return this.items.length;
  }

  get isFull(): boolean {
    return this.items.length >= this.maxSize;
  }

  peekAll(): readonly QueuedLead[] {
    return this.items;
  }

  /** Appends to the tail (FIFO). Rejects with `AssignmentError` once `maxSize` is reached — `QueueService.enqueue`'s `maxQueueSize` enforcement. */
  enqueue(lead: QueuedLead): Result<AssignmentQueue, AssignmentError> {
    if (this.isFull) {
      return err(
        new AssignmentError(
          `Queue for branch "${this.branchId}" is full (maxQueueSize=${this.maxSize})`,
        ),
      );
    }
    return ok(new AssignmentQueue(this.branchId, this.maxSize, [...this.items, lead]));
  }

  /** Removes and returns the head (FIFO order). `lead` is `undefined` when empty — the queue itself is unchanged in that case. */
  dequeue(): { readonly queue: AssignmentQueue; readonly lead: QueuedLead | undefined } {
    if (this.items.length === 0) {
      return { queue: this, lead: undefined };
    }
    const [head, ...rest] = this.items;
    return { queue: new AssignmentQueue(this.branchId, this.maxSize, rest), lead: head };
  }

  /** Drops entries older than `ttlMs` relative to `now`, per the injectable-clock discipline (never a raw `Date.now()` call). */
  removeExpired(
    now: Date,
    ttlMs: number,
  ): { readonly queue: AssignmentQueue; readonly removed: readonly QueuedLead[] } {
    const fresh: QueuedLead[] = [];
    const removed: QueuedLead[] = [];
    for (const item of this.items) {
      if (now.getTime() - item.enqueuedAt.getTime() > ttlMs) {
        removed.push(item);
      } else {
        fresh.push(item);
      }
    }
    if (removed.length === 0) {
      return { queue: this, removed: [] };
    }
    return { queue: new AssignmentQueue(this.branchId, this.maxSize, fresh), removed };
  }
}
