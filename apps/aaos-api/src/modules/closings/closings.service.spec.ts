import { BranchId } from "@aos/branch-manager";
import { ClosingRepository, ClosingType, LeadStoreFactory } from "@aos/lead-store";
import { describe, expect, it } from "vitest";

import { toLeadStoreConfig } from "../../config/to-lead-store-config.js";
import { createFakePublisher } from "../../test-support/fake-publisher.js";
import { createFakeSupabaseClient, type Row } from "../../test-support/fake-supabase-client.js";
import { buildTestConfig } from "../../test-support/fixtures.js";

import { ClosingsService } from "./closings.service.js";

function seedLeadRow(overrides: Row = {}): Row {
  const now = new Date("2026-01-15T09:00:00.000Z").toISOString();
  return {
    id: "11111111-1111-4111-8111-111111111111",
    tenant_id: "dss-motor",
    lead_source: "CTWA",
    campaign_id: "#C047",
    ad_id: "#A001",
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
  return { service: new ClosingsService(config, leadStore, closingRepository), client };
}

describe("ClosingsService.createClosing", () => {
  it("records a closing via @aos/lead-store's RecordClosing and maps it to a ClosingResponseDto", async () => {
    const { service, client } = buildService();
    client.seed("leads", seedLeadRow());
    const dto = await service.createClosing(
      {
        leadId: "11111111-1111-4111-8111-111111111111",
        salesHumanId: "sales-rina",
        closingType: ClosingType.SPK,
        unitModel: "Xpander Cross AT 2020",
        unitPrice: 195_000_000,
        commissionPct: 3,
        commissionIdr: 5_850_000,
      },
      "corr-closing-1",
    );
    expect(dto.closingType).toBe("SPK");
    expect(dto.commissionIdr).toBe(5_850_000);
    expect(dto.salesHumanId).toBe("sales-rina");
  });

  it("throws the raw @aos/lead-store error when the lead does not exist", async () => {
    const { service } = buildService();
    await expect(
      service.createClosing(
        {
          leadId: "00000000-0000-4000-8000-000000000000",
          salesHumanId: "sales-rina",
          closingType: ClosingType.TEST_DRIVE,
        },
        "corr-closing-2",
      ),
    ).rejects.toThrow();
  });
});

describe("ClosingsService.getClosings", () => {
  it("filters by salesHumanId (AAOS-W4B coordinator note #4)", async () => {
    const client = createFakeSupabaseClient();
    const { service } = buildService(client);
    const now = new Date().toISOString();
    client.seed("closings", {
      id: "c1",
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
    });
    client.seed("closings", {
      id: "c2",
      lead_id: "lead-2",
      sales_human_id: "sales-budi",
      branch_id: BranchId.UMUM,
      closing_type: "SPK",
      unit_id: null,
      unit_model: null,
      unit_price: null,
      campaign_id: null,
      ad_id: null,
      commission_idr: 2_000_000,
      commission_pct: null,
      notes: null,
      test_drive_at: null,
      spk_at: now,
      created_at: now,
    });

    const dtos = await service.getClosings({ salesHumanId: "sales-rina" });
    expect(dtos).toHaveLength(1);
    expect(dtos[0]?.id).toBe("c1");
  });

  it("defaults to the current calendar month when fromDate/toDate are omitted", async () => {
    const { service } = buildService();
    const dtos = await service.getClosings({});
    expect(dtos).toEqual([]);
  });

  it("respects an explicit fromDate/toDate range", async () => {
    const client = createFakeSupabaseClient();
    const { service } = buildService(client);
    client.seed("closings", {
      id: "c3",
      lead_id: "lead-3",
      sales_human_id: "sales-rina",
      branch_id: BranchId.UMUM,
      closing_type: "TEST_DRIVE",
      unit_id: null,
      unit_model: null,
      unit_price: null,
      campaign_id: null,
      ad_id: null,
      commission_idr: null,
      commission_pct: null,
      notes: null,
      test_drive_at: "2026-01-10T00:00:00.000Z",
      spk_at: null,
      created_at: "2026-01-10T00:00:00.000Z",
    });
    const dtos = await service.getClosings({
      fromDate: "2026-01-01T00:00:00.000Z",
      toDate: "2026-01-31T23:59:59.000Z",
    });
    expect(dtos).toHaveLength(1);
  });
});
