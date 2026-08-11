import { SalesHumanId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { ClosingService } from "../../../src/application/services/ClosingService.js";
import { GetClosingStats } from "../../../src/application/use-cases/GetClosingStats.js";
import { RecordClosing } from "../../../src/application/use-cases/RecordClosing.js";
import { LeadStoreEvents } from "../../../src/domain/events/LeadStoreEvents.js";
import { ClosingType } from "../../../src/domain/value-objects/ClosingType.js";
import { ClosingRepository } from "../../../src/infrastructure/supabase/ClosingRepository.js";
import { LeadRepository } from "../../../src/infrastructure/supabase/LeadRepository.js";
import { makeClosingRow, makeLeadRow } from "../../fixtures/leadStoreFixtures.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap } from "../../helpers/result.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

function setup() {
  const client = createFakeSupabaseClient();
  const leadRow = makeLeadRow({ status: "ASSIGNED" });
  client.seed("leads", [leadRow]);
  const closingRepository = new ClosingRepository(client);
  const leadRepository = new LeadRepository(client);
  const events = new LeadStoreEvents(createFakePublisher());
  const spendProvider = {
    getSpendByCampaign: async (ids: readonly string[]) => new Map(ids.map((id) => [id, 0])),
  };

  const service = new ClosingService(
    new RecordClosing(leadRepository, closingRepository, events),
    new GetClosingStats(closingRepository, spendProvider),
  );
  return { service, leadRow, client };
}

describe("ClosingService facade", () => {
  it("record() delegates to RecordClosing", async () => {
    const { service, leadRow } = setup();
    const closing = unwrap(
      await service.record({
        leadId: leadRow.id,
        salesHumanId: SalesHumanId.generate().toString(),
        closingType: ClosingType.SPK,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(closing.closingType).toBe(ClosingType.SPK);
  });

  it("stats() delegates to GetClosingStats", async () => {
    const { service, client } = setup();
    client.seed("closings", [makeClosingRow({ created_at: "2026-01-15T00:00:00.000Z" })]);
    const stats = unwrap(
      await service.stats({
        fromDate: new Date("2026-01-01T00:00:00.000Z"),
        toDate: new Date("2026-01-31T00:00:00.000Z"),
      }),
    );
    expect(stats.totalClosings).toBe(1);
  });
});
