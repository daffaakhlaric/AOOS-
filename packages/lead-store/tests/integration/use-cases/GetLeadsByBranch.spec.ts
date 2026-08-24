import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { GetLeadsByBranch } from "../../../src/application/use-cases/GetLeadsByBranch.js";
import { LeadRepository } from "../../../src/infrastructure/supabase/LeadRepository.js";
import { makeLeadRow } from "../../fixtures/leadStoreFixtures.js";
import { unwrap } from "../../helpers/result.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

describe("GetLeadsByBranch", () => {
  it("returns only leads for the given branch", async () => {
    const client = createFakeSupabaseClient();
    client.seed("leads", [
      makeLeadRow({ branch_id: BranchId.BINTARO }),
      makeLeadRow({ branch_id: BranchId.BANDUNG }),
    ]);
    const useCase = new GetLeadsByBranch(new LeadRepository(client));
    const result = unwrap(await useCase.execute(BranchId.BINTARO, "dss-motor"));
    expect(result).toHaveLength(1);
  });

  it("returns an empty array when no leads exist for the branch", async () => {
    const client = createFakeSupabaseClient();
    const useCase = new GetLeadsByBranch(new LeadRepository(client));
    const result = unwrap(await useCase.execute(BranchId.UMUM, "dss-motor"));
    expect(result).toHaveLength(0);
  });

  it("does not return a same-branch lead belonging to a different tenant (Multi-Tenant Phase 1B)", async () => {
    const client = createFakeSupabaseClient();
    client.seed("leads", [
      makeLeadRow({ branch_id: BranchId.BINTARO, tenant_id: "dss-motor" }),
      makeLeadRow({ branch_id: BranchId.BINTARO, tenant_id: "other-tenant" }),
    ]);
    const useCase = new GetLeadsByBranch(new LeadRepository(client));
    const result = unwrap(await useCase.execute(BranchId.BINTARO, "dss-motor"));
    expect(result).toHaveLength(1);
  });
});
