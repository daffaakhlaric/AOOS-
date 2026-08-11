import { ok, type Result } from "@aos/common";

import type { EscalationRequest } from "../../domain/entities/EscalationRequest.js";
import type { TamaraAgent } from "../../domain/entities/TamaraAgent.js";
import type { AgentError } from "../../domain/errors/index.js";
import type { EscalationService } from "../services/EscalationService.js";
import type { TamaraAgentService } from "../services/TamaraAgentService.js";

export interface GetAgentStatusOutput {
  readonly agent: TamaraAgent;
  readonly pendingEscalations: ReadonlyArray<EscalationRequest>;
  readonly decisionOutcomeCount: number;
}

/**
 * Reports Tamara's current state + pending decisions (spec: "GetAgentStatus"). `TamaraAgentService`
 * always holds a valid `TamaraAgent` once constructed (see its constructor), so this use case has
 * no failure path of its own — it still returns `Result` per the package's uniform discipline.
 */
export class GetAgentStatus {
  constructor(
    private readonly agentService: TamaraAgentService,
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
