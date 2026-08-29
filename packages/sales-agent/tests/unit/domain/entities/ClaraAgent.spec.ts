import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { ClaraAgent } from "../../../../src/domain/entities/ClaraAgent.js";

describe("ClaraAgent", () => {
  it("create() sets name to 'Clara' and carries branchId + tenantId", () => {
    const agent = ClaraAgent.create(BranchId.BINTARO, "tenant-dss-motor");
    expect(agent.name).toBe("Clara");
    expect(agent.branchId).toBe(BranchId.BINTARO);
    expect(agent.tenantId).toBe("tenant-dss-motor");
  });
});
