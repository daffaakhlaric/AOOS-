import { describe, expect, it } from "vitest";

import { SamanthaAgent } from "../../../../src/domain/entities/SamanthaAgent.js";
import { AgentState } from "../../../../src/domain/value-objects/AgentState.js";
import { unwrap } from "../../../helpers/result.js";

function baseProps() {
  return {
    id: "agent-1",
    tenantId: "dss-motor",
    name: "Samantha" as const,
    state: AgentState.IDLE,
    createdAt: new Date("2026-08-09T00:00:00.000Z"),
    cycleCount: 0,
  };
}

describe("SamanthaAgent", () => {
  it("creates a valid agent", () => {
    expect(SamanthaAgent.create(baseProps()).ok).toBe(true);
  });

  it("rejects an empty tenantId", () => {
    expect(SamanthaAgent.create({ ...baseProps(), tenantId: "" }).ok).toBe(false);
  });

  it("rejects an invalid state", () => {
    expect(SamanthaAgent.create({ ...baseProps(), state: "BOGUS" as never }).ok).toBe(false);
  });

  it("rejects a negative cycleCount", () => {
    expect(SamanthaAgent.create({ ...baseProps(), cycleCount: -1 }).ok).toBe(false);
  });

  it("rejects a fractional cycleCount", () => {
    expect(SamanthaAgent.create({ ...baseProps(), cycleCount: 1.5 }).ok).toBe(false);
  });

  it("exposes every getter", () => {
    const props = baseProps();
    const agent = unwrap(SamanthaAgent.create(props));
    expect(agent.id).toBe("agent-1");
    expect(agent.tenantId).toBe("dss-motor");
    expect(agent.name).toBe("Samantha");
    expect(agent.state).toBe(AgentState.IDLE);
    expect(agent.createdAt).toEqual(props.createdAt);
    expect(agent.lastCycleAt).toBeUndefined();
    expect(agent.cycleCount).toBe(0);
  });

  it("transitionTo returns a new agent in the given state, not mutating the original", () => {
    const agent = unwrap(SamanthaAgent.create(baseProps()));
    const analyzing = agent.transitionTo(AgentState.ANALYZING);
    expect(agent.state).toBe(AgentState.IDLE);
    expect(analyzing.state).toBe(AgentState.ANALYZING);
  });

  it("completeCycle increments cycleCount, stamps lastCycleAt, and returns to IDLE", () => {
    const agent = unwrap(SamanthaAgent.create(baseProps())).transitionTo(AgentState.EXECUTING);
    const completedAt = new Date("2026-08-09T12:00:00.000Z");
    const completed = agent.completeCycle(completedAt);
    expect(completed.state).toBe(AgentState.IDLE);
    expect(completed.cycleCount).toBe(1);
    expect(completed.lastCycleAt).toEqual(completedAt);
  });
});
