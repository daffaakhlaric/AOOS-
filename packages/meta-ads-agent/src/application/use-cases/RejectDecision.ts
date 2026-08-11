import { err, ok, type Result } from "@aos/common";
import type { Logger } from "@aos/logger";

import type { AgentMemory } from "../../domain/entities/AgentMemory.js";
import type { EscalationRequest } from "../../domain/entities/EscalationRequest.js";
import type { EscalationError } from "../../domain/errors/index.js";
import type { EscalationService } from "../services/EscalationService.js";

export interface RejectDecisionInput {
  readonly decisionId: string;
  readonly resolvedBy: string;
}

/** Human rejects an ESCALATE-classified `CampaignDecision` (spec: "RejectDecision"). */
export class RejectDecision {
  constructor(
    private readonly escalationService: EscalationService,
    private readonly memory: AgentMemory,
    private readonly logger: Logger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  execute(input: RejectDecisionInput): Result<EscalationRequest, EscalationError> {
    const result = this.escalationService.reject(input.decisionId, this.now(), input.resolvedBy);
    if (!result.ok) {
      return err(result.error);
    }
    this.memory.recordEscalationOutcome(input.decisionId, "REJECTED");
    this.logger.info({ decisionId: input.decisionId }, "meta-ads-agent: decision rejected");
    return ok(result.value);
  }
}
