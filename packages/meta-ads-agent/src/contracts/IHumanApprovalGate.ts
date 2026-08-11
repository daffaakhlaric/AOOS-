import type { Result } from "@aos/common";

import type { EscalationRequest } from "../domain/entities/EscalationRequest.js";
import type { EscalationError } from "../domain/errors/index.js";

/** Port for the human-approval queue — implemented by `application/services/EscalationService.ts`. */
export interface IHumanApprovalGate {
  enqueue(request: EscalationRequest): void;
  approve(
    decisionId: string,
    resolvedAt: Date,
    resolvedBy: string,
  ): Result<EscalationRequest, EscalationError>;
  reject(
    decisionId: string,
    resolvedAt: Date,
    resolvedBy: string,
  ): Result<EscalationRequest, EscalationError>;
  listPending(): ReadonlyArray<EscalationRequest>;
}
