import { ok, type Result } from "@aos/common";

import type { EscalationRequest } from "../../domain/entities/EscalationRequest.js";
import type { SamanthaAgent } from "../../domain/entities/SamanthaAgent.js";
import type { AgentError } from "../../domain/errors/index.js";
import type { EscalationService } from "../services/EscalationService.js";
import type { SamanthaAgentService } from "../services/SamanthaAgentService.js";

export interface GetAgentStatusOutput {
  readonly agent: SamanthaAgent;
  readonly pendingEscalations: ReadonlyArray<EscalationRequest>;
  readonly decisionOutcomeCount: number;
}

/**
 * Reports Samantha's current state + pending decisions (spec: "GetAgentStatus"). `SamanthaAgentService`
 * always holds a valid `SamanthaAgent` once constructed (see its constructor), so this use case has
 * no failure path of its own — it still returns `Result` per the package's uniform discipline.
 */
export class GetAgentStatus {
  constructor(
    private readonly agentService: SamanthaAgentService,
    private readonly escalationService: EscalationService,
  ) {}

  execute(): Result<GetAgentStatusOutput, AgentError> {
    return ok({
      agent: this.agentService.getAgent(),
      pendingEscalations: this.escalationService.listPending(),
      decisionOutcomeCount: this.agentService.getMemory().decisionOutcomeCount,
    });
  }
}
