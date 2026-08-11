import { describe, expect, it } from "vitest";

import { TamaraAgent } from "../../../src/domain/entities/TamaraAgent.js";
import { AgentState } from "../../../src/domain/value-objects/AgentState.js";
import { AgentRegistry } from "../../../src/registry/AgentRegistry.js";
import { unwrap } from "../../helpers/result.js";

function agent(id: string, tenantId: string) {
  return unwrap(
    TamaraAgent.create({
      id,
      tenantId,
      name: "Tamara",
      state: AgentState.IDLE,
      createdAt: new Date(),
      cycleCount: 0,
    }),
  );
}

describe("AgentRegistry", () => {
  it("save + get round-trips an agent", () => {
    const registry = new AgentRegistry();
    const a = agent("a1", "dss-motor");
    registry.save(a);
    const found = registry.get("a1");
    expect(found.some).toBe(true);
    expect(found.some && found.value).toBe(a);
  });

  it("get returns none for an unknown id", () => {
    const registry = new AgentRegistry();
    expect(registry.get("unknown").some).toBe(false);
  });

  it("listByTenant filters by tenantId", () => {
    const registry = new AgentRegistry();
    registry.save(agent("a1", "dss-motor"));
    registry.save(agent("a2", "other-tenant"));
    expect(registry.listByTenant("dss-motor")).toHaveLength(1);
  });
});
