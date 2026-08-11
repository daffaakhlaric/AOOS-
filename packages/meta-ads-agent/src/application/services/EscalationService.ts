import { err, ok, type Result } from "@aos/common";

import type { IHumanApprovalGate } from "../../contracts/IHumanApprovalGate.js";
import type { EscalationRequest } from "../../domain/entities/EscalationRequest.js";
import { EscalationError } from "../../domain/errors/index.js";

/** The human-approval queue for ESCALATE-classified `CampaignDecision`s — a plain in-memory `Map`. */
export class EscalationService implements IHumanApprovalGate {
  private readonly queue = new Map<string, EscalationRequest>();

  enqueue(request: EscalationRequest): void {
    this.queue.set(request.decision.id.toString(), request);
  }

  approve(
    decisionId: string,
    resolvedAt: Date,
    resolvedBy: string,
  ): Result<EscalationRequest, EscalationError> {
    const existing = this.queue.get(decisionId);
    if (!existing) {
      return err(new EscalationError(`No escalation request found for decision "${decisionId}"`));
    }
    if (!existing.isPending()) {
      return err(
        new EscalationError(
          `Escalation request for decision "${decisionId}" is already ${existing.status}`,
        ),
      );
    }
    const approved = existing.approve(resolvedAt, resolvedBy);
    this.queue.set(decisionId, approved);
    return ok(approved);
  }

  reject(
    decisionId: string,
    resolvedAt: Date,
    resolvedBy: string,
  ): Result<EscalationRequest, EscalationError> {
    const existing = this.queue.get(decisionId);
    if (!existing) {
      return err(new EscalationError(`No escalation request found for decision "${decisionId}"`));
    }
    if (!existing.isPending()) {
      return err(
        new EscalationError(
          `Escalation request for decision "${decisionId}" is already ${existing.status}`,
        ),
      );
    }
    const rejected = existing.reject(resolvedAt, resolvedBy);
    this.queue.set(decisionId, rejected);
    return ok(rejected);
  }

  listPending(): ReadonlyArray<EscalationRequest> {
    return [...this.queue.values()].filter((request) => request.isPending());
  }

  listAll(): ReadonlyArray<EscalationRequest> {
    return [...this.queue.values()];
  }

  get(decisionId: string): EscalationRequest | undefined {
    return this.queue.get(decisionId);
  }
}
