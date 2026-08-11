import type { Result } from "@aos/common";

import type { CampaignDecision } from "../../domain/entities/CampaignDecision.js";
import type { ExecutionError } from "../../domain/errors/index.js";
import type { ExecutionService } from "../services/ExecutionService.js";

export interface ExecuteDecisionInput {
  readonly decision: CampaignDecision;
  readonly tenantId: string;
  readonly correlationId: string;
}

/** Executes a single approved (`AUTO_EXECUTE`, or a human-`APPROVED` former-`ESCALATE`) `CampaignDecision` (spec: "ExecuteDecision"). */
export class ExecuteDecision {
  constructor(private readonly executionService: ExecutionService) {}

  async execute(input: ExecuteDecisionInput): Promise<Result<void, ExecutionError>> {
    return this.executionService.execute(input.decision, input.tenantId, input.correlationId);
  }
}
