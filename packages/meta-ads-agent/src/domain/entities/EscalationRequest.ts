import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { EscalationStatus } from "../../types/AgentTypes.js";
import type { DecisionId } from "../value-objects/DecisionId.js";

import type { CampaignDecision } from "./CampaignDecision.js";

export interface EscalationRequestProps {
  readonly id: DecisionId;
  readonly decision: CampaignDecision;
  readonly status: EscalationStatus;
  readonly createdAt: Date;
  readonly resolvedAt?: Date;
  readonly resolvedBy?: string;
}

const STATUSES: ReadonlySet<string> = new Set(["PENDING", "APPROVED", "REJECTED"]);

/** A non-routine `CampaignDecision` queued for human approval — DSS decides via `ApproveDecision`/`RejectDecision`. */
export class EscalationRequest {
  private constructor(private readonly props: EscalationRequestProps) {}

  static create(props: EscalationRequestProps): Result<EscalationRequest, ValidationError> {
    if (!STATUSES.has(props.status)) {
      return err(
        new ValidationError(
          `EscalationRequest.status must be PENDING|APPROVED|REJECTED, received: ${String(props.status)}`,
        ),
      );
    }
    return ok(new EscalationRequest({ ...props }));
  }

  get id(): DecisionId {
    return this.props.id;
  }

  get decision(): CampaignDecision {
    return this.props.decision;
  }

  get status(): EscalationStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get resolvedAt(): Date | undefined {
    return this.props.resolvedAt;
  }

  get resolvedBy(): string | undefined {
    return this.props.resolvedBy;
  }

  /** Returns a new APPROVED EscalationRequest — never mutates `this`. */
  approve(resolvedAt: Date, resolvedBy: string): EscalationRequest {
    return new EscalationRequest({ ...this.props, status: "APPROVED", resolvedAt, resolvedBy });
  }

  /** Returns a new REJECTED EscalationRequest — never mutates `this`. */
  reject(resolvedAt: Date, resolvedBy: string): EscalationRequest {
    return new EscalationRequest({ ...this.props, status: "REJECTED", resolvedAt, resolvedBy });
  }

  isPending(): boolean {
    return this.props.status === "PENDING";
  }
}
