import { describe, expect, it } from "vitest";

import { TamaraAgent } from "../../../../src/domain/entities/TamaraAgent.js";
import { AgentState } from "../../../../src/domain/value-objects/AgentState.js";
import { unwrap } from "../../../helpers/result.js";

function baseProps() {
  return {
    id: "agent-1",
    tenantId: "dss-motor",
    name: "Tamara" as const,
    state: AgentState.IDLE,
    createdAt: new Date("2026-08-09T00:00:00.000Z"),
    cycleCount: 0,
  };
}

describe("TamaraAgent", () => {
  it("creates a valid agent", () => {
    expect(TamaraAgent.create(baseProps()).ok).toBe(true);
  });

  it("rejects an empty tenantId", () => {
    expect(TamaraAgent.create({ ...baseProps(), tenantId: "" }).ok).toBe(false);
  });

  it("rejects an invalid state", () => {
    expect(TamaraAgent.create({ ...baseProps(), state: "BOGUS" as never }).ok).toBe(false);
  });

  it("rejects a negative cycleCount", () => {
    expect(TamaraAgent.create({ ...baseProps(), cycleCount: -1 }).ok).toBe(false);
  });

  it("rejects a fractional cycleCount", () => {
    expect(TamaraAgent.create({ ...baseProps(), cycleCount: 1.5 }).ok).toBe(false);
  });

  it("exposes every getter", () => {
    const props = baseProps();
    const agent = unwrap(TamaraAgent.create(props));
    expect(agent.id).toBe("agent-1");
    expect(agent.tenantId).toBe("dss-motor");
    expect(agent.name).toBe("Tamara");
    expect(agent.state).toBe(AgentState.IDLE);
    expect(agent.createdAt).toEqual(props.createdAt);
    expect(agent.lastCycleAt).toBeUndefined();
    expect(agent.cycleCount).toBe(0);
  });

  it("transitionTo returns a new agent in the given state, not mutating the original", () => {
    const agent = unwrap(TamaraAgent.create(baseProps()));
    const analyzing = agent.transitionTo(AgentState.ANALYZING);
    expect(agent.state).toBe(AgentState.IDLE);
    expect(analyzing.state).toBe(AgentState.ANALYZING);
  });

  it("completeCycle increments cycleCount, stamps lastCycleAt, and returns to IDLE", () => {
    const agent = unwrap(TamaraAgent.create(baseProps())).transitionTo(AgentState.EXECUTING);
    const completedAt = new Date("2026-08-09T12:00:00.000Z");
    const completed = agent.completeCycle(completedAt);
    expect(completed.state).toBe(AgentState.IDLE);
    expect(completed.cycleCount).toBe(1);
    expect(completed.lastCycleAt).toEqual(completedAt);
  });
});
