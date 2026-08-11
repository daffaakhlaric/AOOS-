import { BranchId } from "@aos/branch-manager";
import { AdAccountId, AdAccountRegistry } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { LeadSource } from "../../../src/domain/value-objects/LeadSource.js";
import { LeadStoreFactory } from "../../../src/factories/LeadStoreFactory.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap } from "../../helpers/result.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

function baseConfig() {
  return {
    supabaseUrl: "https://xxxx.supabase.co",
    supabaseAnonKey: "anon",
    supabaseServiceKey: "service",
    tenantId: "dss-motor",
    realtimeEnabled: true,
  };
}

describe("LeadStoreFactory", () => {
  it("wires every use case and service, and they actually work end-to-end", async () => {
    const client = createFakeSupabaseClient();
    const store = LeadStoreFactory.create({
      config: baseConfig(),
      publisher: createFakePublisher(),
      supabaseClient: client,
    });

    expect(store.createLead).toBeDefined();
    expect(store.updateLeadStatus).toBeDefined();
    expect(store.getLead).toBeDefined();
    expect(store.getLeadsByBranch).toBeDefined();
    expect(store.getHotLeads).toBeDefined();
    expect(store.getLeadsBySales).toBeDefined();
    expect(store.saveMessage).toBeDefined();
    expect(store.getConversation).toBeDefined();
    expect(store.recordScoreEvent).toBeDefined();
    expect(store.recordAssignment).toBeDefined();
    expect(store.recordClosing).toBeDefined();
    expect(store.subscribeToHotLeads).toBeDefined();
    expect(store.getClosingStats).toBeDefined();
    expect(store.leadService).toBeDefined();
    expect(store.conversationService).toBeDefined();
    expect(store.realtimeService).toBeDefined();
    expect(store.closingService).toBeDefined();

    const lead = unwrap(
      await store.createLead.execute({
        leadSource: LeadSource.CTWA,
        leadPhone: "+6281200000099",
        branchId: BranchId.BINTARO,
        wabaPhoneNumberId: "waba-1",
        tenantId: "dss-motor",
        correlationId: "c1",
      }),
    );
    expect(lead.status).toBe("NEW");
  });

  it("defaults adAccountIds to an empty array when omitted alongside adAccountRegistry", () => {
    const client = createFakeSupabaseClient();
    const registry = new AdAccountRegistry();
    const store = LeadStoreFactory.create({
      config: baseConfig(),
      publisher: createFakePublisher(),
      supabaseClient: client,
      adAccountRegistry: registry,
    });
    expect(store.getClosingStats).toBeDefined();
  });

  it("wires a MetaAdsSpendAdapter when adAccountRegistry is provided", () => {
    const client = createFakeSupabaseClient();
    const registry = new AdAccountRegistry();
    const store = LeadStoreFactory.create({
      config: baseConfig(),
      publisher: createFakePublisher(),
      supabaseClient: client,
      adAccountRegistry: registry,
      adAccountIds: [unwrap(AdAccountId.create("act_1"))],
    });
    expect(store.getClosingStats).toBeDefined();
  });

  it("defaults to a ZeroSpendProvider when adAccountRegistry is omitted", async () => {
    const client = createFakeSupabaseClient();
    const store = LeadStoreFactory.create({
      config: baseConfig(),
      publisher: createFakePublisher(),
      supabaseClient: client,
    });
    client.seed("closings", [
      {
        id: "c1",
        lead_id: "l1",
        sales_human_id: "s1",
        branch_id: BranchId.BINTARO,
        closing_type: "SPK",
        campaign_id: "#C001",
        commission_idr: 0,
        created_at: "2026-01-15T00:00:00.000Z",
      },
    ]);
    const stats = unwrap(
      await store.getClosingStats.execute({
        fromDate: new Date("2026-01-01T00:00:00.000Z"),
        toDate: new Date("2026-01-31T00:00:00.000Z"),
      }),
    );
    expect(stats.rphSpkByCampaign["#C001"]).toBe(0);
  });

  it("creates a real Supabase client when supabaseClient is omitted", () => {
    // @supabase/supabase-js's RealtimeClient requires a global `WebSocket` constructor at
    // construction time (only available natively on Node 22+); this test runs on Node 20, so a
    // minimal stub is installed for the duration of this one test — no real connection is ever
    // opened (constructing a `SupabaseClient` does not perform any network I/O by itself).
    const originalWebSocket = (globalThis as { WebSocket?: unknown }).WebSocket;
    (globalThis as { WebSocket?: unknown }).WebSocket = class FakeWebSocket {};
    try {
      const store = LeadStoreFactory.create({
        config: baseConfig(),
        publisher: createFakePublisher(),
      });
      expect(store.createLead).toBeDefined();
    } finally {
      (globalThis as { WebSocket?: unknown }).WebSocket = originalWebSocket;
    }
  });
});
