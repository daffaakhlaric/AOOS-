import { describe, expect, it } from "vitest";

import { TamaraAgentService } from "../../../../src/application/services/TamaraAgentService.js";
import { AgentState } from "../../../../src/domain/value-objects/AgentState.js";
import { AgentRegistry } from "../../../../src/registry/AgentRegistry.js";
import { DecisionRegistry } from "../../../../src/registry/DecisionRegistry.js";

const now = () => new Date("2026-08-09T00:00:00.000Z");

describe("TamaraAgentService", () => {
  it("constructs a fresh IDLE TamaraAgent and registers it", () => {
    const registry = new AgentRegistry();
    const service = new TamaraAgentService("dss-motor", registry, new DecisionRegistry(), now);
    expect(service.getAgent().state).toBe(AgentState.IDLE);
    expect(service.getAgent().tenantId).toBe("dss-motor");
    expect(registry.get(service.getAgent().id).some).toBe(true);
  });

  it("starts with a fresh, empty AgentMemory", () => {
    const service = new TamaraAgentService(
      "dss-motor",
      new AgentRegistry(),
      new DecisionRegistry(),
      now,
    );
    expect(service.getMemory().decisionOutcomeCount).toBe(0);
  });

  it("two separately-created agents do not share memory", () => {
    const a = new TamaraAgentService("dss-motor", new AgentRegistry(), new DecisionRegistry(), now);
    const b = new TamaraAgentService("dss-motor", new AgentRegistry(), new DecisionRegistry(), now);
    a.getMemory().recordEscalationOutcome("d1", "APPROVED");
    expect(b.getMemory().escalationOutcomes.size).toBe(0);
  });

  it("one agent run through two cycles DOES accumulate memory", () => {
    const service = new TamaraAgentService(
      "dss-motor",
      new AgentRegistry(),
      new DecisionRegistry(),
      now,
    );
    service.getMemory().recordDecisionOutcome({
      decisionId: "d1",
      actionKind: "PAUSE",
      rphChatBeforeIDR: null,
      rphChatAfterIDR: null,
      recordedAt: now(),
    });
    service.completeCycle(now());
    service.getMemory().recordDecisionOutcome({
      decisionId: "d2",
      actionKind: "SCALE",
      rphChatBeforeIDR: null,
      rphChatAfterIDR: null,
      recordedAt: now(),
    });
    service.completeCycle(now());
    expect(service.getMemory().decisionOutcomeCount).toBe(2);
    expect(service.getAgent().cycleCount).toBe(2);
  });

  it("transitionTo updates the agent's state and re-registers it", () => {
    const registry = new AgentRegistry();
    const service = new TamaraAgentService("dss-motor", registry, new DecisionRegistry(), now);
    service.transitionTo(AgentState.ANALYZING);
    expect(service.getAgent().state).toBe(AgentState.ANALYZING);
    expect(
      registry.get(service.getAgent().id).some && registry.get(service.getAgent().id),
    ).toMatchObject({ some: true });
  });

  it("completeCycle transitions back to IDLE and stamps lastCycleAt", () => {
    const service = new TamaraAgentService(
      "dss-motor",
      new AgentRegistry(),
      new DecisionRegistry(),
      now,
    );
    service.transitionTo(AgentState.EXECUTING);
    const completedAt = new Date("2026-08-09T05:00:00.000Z");
    service.completeCycle(completedAt);
    expect(service.getAgent().state).toBe(AgentState.IDLE);
    expect(service.getAgent().lastCycleAt).toEqual(completedAt);
  });

  it("uses the real wall clock when no clock is injected", () => {
    const service = new TamaraAgentService(
      "dss-motor",
      new AgentRegistry(),
      new DecisionRegistry(),
    );
    expect(service.getAgent().createdAt).toBeInstanceOf(Date);
  });

  it("exposes the injected DecisionRegistry", () => {
    const decisionRegistry = new DecisionRegistry();
    const service = new TamaraAgentService("dss-motor", new AgentRegistry(), decisionRegistry, now);
    expect(service.getDecisionRegistry()).toBe(decisionRegistry);
  });
});
