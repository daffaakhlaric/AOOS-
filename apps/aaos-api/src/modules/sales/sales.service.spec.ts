import { BranchId } from "@aos/branch-manager";
import { ClosingRepository, LeadStoreFactory } from "@aos/lead-store";
import { describe, expect, it } from "vitest";

import { toLeadStoreConfig } from "../../config/to-lead-store-config.js";
import { createFakePublisher } from "../../test-support/fake-publisher.js";
import { createFakeSupabaseClient, type Row } from "../../test-support/fake-supabase-client.js";
import { buildTestConfig } from "../../test-support/fixtures.js";

import { SalesService } from "./sales.service.js";

function seedLeadRow(overrides: Row = {}): Row {
  const now = new Date().toISOString();
  return {
    id: "11111111-1111-4111-8111-111111111111",
    tenant_id: "dss-motor",
    lead_source: "CTWA",
    campaign_id: null,
    ad_id: null,
    ad_account_id: null,
    lead_phone: "+6281200000097",
    lead_name: "Budi",
    branch_id: BranchId.UMUM,
    waba_phone_number_id: "waba-umum-1",
    status: "ASSIGNED",
    score: 80,
    temperature: "HOT",
    qual_budget: true,
    qual_unit: true,
    qual_area: true,
    qual_payment: true,
    qual_timeline: true,
    qual_name: true,
    assigned_sales_id: "sales-rina",
    assigned_at: now,
    assignment_mode: "MANUAL",
    first_message_at: now,
    last_message_at: now,
    became_hot_at: now,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function seedClosingRow(overrides: Row = {}): Row {
  const now = new Date().toISOString();
  return {
    id: "closing-1",
    lead_id: "lead-1",
    sales_human_id: "sales-rina",
    branch_id: BranchId.UMUM,
    closing_type: "SPK",
    unit_id: null,
    unit_model: null,
    unit_price: null,
    campaign_id: null,
    ad_id: null,
    commission_idr: 1_000_000,
    commission_pct: null,
    notes: null,
    test_drive_at: null,
    spk_at: now,
    created_at: now,
    ...overrides,
  };
}

function buildService(client = createFakeSupabaseClient()) {
  const config = buildTestConfig();
  const leadStoreConfig = toLeadStoreConfig(config);
  if (!leadStoreConfig.ok) {
    throw new Error("test setup failed");
  }
  const leadStore = LeadStoreFactory.create({
    config: leadStoreConfig.value,
    publisher: createFakePublisher(),
    supabaseClient: client,
  });
  const closingRepository = new ClosingRepository(client);
  return { service: new SalesService(leadStore, closingRepository), client };
}

describe("SalesService.getStats", () => {
  it("computes leadsToday from leads assigned today", async () => {
    const client = createFakeSupabaseClient();
    const { service } = buildService(client);
    client.seed("leads", seedLeadRow());
    const stats = await service.getStats({ salesHumanId: "sales-rina" });
    expect(stats.leadsToday).toBe(1);
  });

  it("splits closings this month into testDriveThisMonth / spkThisMonth and sums commission", async () => {
    const client = createFakeSupabaseClient();
    const { service } = buildService(client);
    client.seed(
      "closings",
      seedClosingRow({ id: "c1", closing_type: "SPK", commission_idr: 1_000_000 }),
    );
    client.seed(
      "closings",
      seedClosingRow({ id: "c2", closing_type: "SPK", commission_idr: 2_000_000 }),
    );
    client.seed(
      "closings",
      seedClosingRow({ id: "c3", closing_type: "TEST_DRIVE", commission_idr: null }),
    );
    const stats = await service.getStats({ salesHumanId: "sales-rina" });
    expect(stats.spkThisMonth).toBe(2);
    expect(stats.testDriveThisMonth).toBe(1);
    expect(stats.commissionThisMonthIdr).toBe(3_000_000);
    expect(stats.recentClosings).toHaveLength(3);
  });

  it("only counts this sales human's own closings (AAOS-W4B coordinator note #4)", async () => {
    const client = createFakeSupabaseClient();
    const { service } = buildService(client);
    client.seed("closings", seedClosingRow({ id: "c1", sales_human_id: "sales-rina" }));
    client.seed("closings", seedClosingRow({ id: "c2", sales_human_id: "sales-budi" }));
    const stats = await service.getStats({ salesHumanId: "sales-rina" });
    expect(stats.recentClosings).toHaveLength(1);
  });

  it("returns all zeros for a sales human with no leads/closings", async () => {
    const { service } = buildService();
    const stats = await service.getStats({ salesHumanId: "sales-nobody" });
    expect(stats).toEqual({
      leadsToday: 0,
      testDriveThisMonth: 0,
      spkThisMonth: 0,
      commissionThisMonthIdr: 0,
      recentClosings: [],
    });
  });

  it("throws a ValidationError for an empty salesHumanId", async () => {
    const { service } = buildService();
    await expect(service.getStats({ salesHumanId: "" })).rejects.toThrow();
  });
});
