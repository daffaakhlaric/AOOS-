import { describe, expect, it } from "vitest";

import { EscalationService } from "../../../../src/application/services/EscalationService.js";
import { SamanthaAgentService } from "../../../../src/application/services/SamanthaAgentService.js";
import { GetAgentStatus } from "../../../../src/application/use-cases/GetAgentStatus.js";
import { AgentRegistry } from "../../../../src/registry/AgentRegistry.js";
import { DecisionRegistry } from "../../../../src/registry/DecisionRegistry.js";

describe("GetAgentStatus", () => {
  it("reports the current agent, pending escalations, and decision outcome count", () => {
    const agentService = new SamanthaAgentService(
      "dss-motor",
      new AgentRegistry(),
      new DecisionRegistry(),
      () => new Date("2026-08-09T00:00:00.000Z"),
    );
    const escalationService = new EscalationService();
    const useCase = new GetAgentStatus(agentService, escalationService);

    const result = useCase.execute();
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.agent).toBe(agentService.getAgent());
    expect(result.ok && result.value.pendingEscalations).toEqual([]);
    expect(result.ok && result.value.decisionOutcomeCount).toBe(0);
  });
});
