import { describe, expect, it } from "vitest";

import { KaiAgent } from "../../../../src/domain/entities/KaiAgent.js";

describe("KaiAgent", () => {
  it("create() sets name to 'Kai'", () => {
    const agent = KaiAgent.create("dss-motor");
    expect(agent.name).toBe("Kai");
  });

  it("create() carries the given tenantId", () => {
    const agent = KaiAgent.create("dss-motor");
    expect(agent.tenantId).toBe("dss-motor");
  });
});
