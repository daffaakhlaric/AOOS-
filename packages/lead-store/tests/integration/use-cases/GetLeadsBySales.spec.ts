import { SalesHumanId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { GetLeadsBySales } from "../../../src/application/use-cases/GetLeadsBySales.js";
import { LeadRepository } from "../../../src/infrastructure/supabase/LeadRepository.js";
import { makeLeadRow } from "../../fixtures/leadStoreFixtures.js";
import { unwrap } from "../../helpers/result.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

describe("GetLeadsBySales", () => {
  it("returns only leads assigned to the given sales human", async () => {
    const client = createFakeSupabaseClient();
    const salesHumanId = SalesHumanId.generate();
    client.seed("leads", [
      makeLeadRow({ assigned_sales_id: salesHumanId.toString(), status: "ASSIGNED" }),
      makeLeadRow({ assigned_sales_id: SalesHumanId.generate().toString(), status: "ASSIGNED" }),
    ]);
    const useCase = new GetLeadsBySales(new LeadRepository(client));
    const result = unwrap(await useCase.execute(salesHumanId));
    expect(result).toHaveLength(1);
  });
});
