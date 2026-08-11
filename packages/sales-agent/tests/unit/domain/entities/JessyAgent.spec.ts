import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { JessyAgent } from "../../../../src/domain/entities/JessyAgent.js";

describe("JessyAgent", () => {
  it("create() sets name to 'Jessy' and carries branchId + tenantId", () => {
    const agent = JessyAgent.create(BranchId.BINTARO, "tenant-dss-motor");
    expect(agent.name).toBe("Jessy");
    expect(agent.branchId).toBe(BranchId.BINTARO);
    expect(agent.tenantId).toBe("tenant-dss-motor");
  });
});
