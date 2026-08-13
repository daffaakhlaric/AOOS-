import { BranchId, SalesHumanId } from "@aos/branch-manager";
import type { SupabaseClientLike } from "@aos/lead-store";
import {
  LeadNotFoundError,
  LeadSource,
  LeadStatus,
  LeadStoreFactory,
  MessageRepository,
} from "@aos/lead-store";
import { describe, expect, it } from "vitest";

import { toLeadStoreConfig } from "../../config/to-lead-store-config.js";
import { createFakePublisher } from "../../test-support/fake-publisher.js";
import { createFakeSupabaseClient } from "../../test-support/fake-supabase-client.js";
import { buildTestConfig } from "../../test-support/fixtures.js";

import { LeadsService } from "./leads.service.js";

type Row = Record<string, unknown>;

/**
 * A minimal, hand-rolled `SupabaseClientLike` test double covering exactly the `select/insert/
 * eq/order/maybeSingle/single` calls `LeadsService`'s two endpoints exercise (`CreateLead`,
 * `GetLeadsByBranch`) — the spec's "mocked Supabase client, zero real network calls" requirement,
 * scoped to this app's own tests (`@aos/lead-store`'s own package has the full-featured fake).
 */
interface FakeSupabaseClient extends SupabaseClientLike {
  /** Test-only: directly appends a raw row to `table`'s in-memory store (bypasses use cases). */
  seed(table: string, row: Row): void;
  /** Test-only: forces the NEXT `select` against `table` to resolve with an error. */
  forceSelectErrorOnce(table: string, message: string): void;
}

function buildFakeSupabaseClient(): FakeSupabaseClient {
  const tables = new Map<string, Row[]>();
  const forcedSelectErrors = new Map<string, string>();

  function tableRows(table: string): Row[] {
    const rows = tables.get(table);
    if (rows !== undefined) {
      return rows;
    }
    const created: Row[] = [];
    tables.set(table, created);
    return created;
  }

  function builder(table: string, mode: "select" | "insert", insertValue?: Row) {
    const filters: Array<[string, unknown]> = [];
    const api = {
      select: () => api,
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        return api;
      },
      order: () => api,
      then: (
        resolve: (result: { data: Row[] | null; error: { message: string } | null }) => void,
      ) => {
        if (mode === "insert" && insertValue !== undefined) {
          const row = { ...insertValue };
          tableRows(table).push(row);
          resolve({ data: [row], error: null });
          return;
        }
        const forcedMessage = forcedSelectErrors.get(table);
        if (forcedMessage !== undefined) {
          forcedSelectErrors.delete(table);
          resolve({ data: null, error: { message: forcedMessage } });
          return;
        }
        const rows = tableRows(table).filter((row) =>
          filters.every(([column, value]) => row[column] === value),
        );
        resolve({ data: rows, error: null });
      },
      maybeSingle: async () => {
        const rows = tableRows(table).filter((row) =>
          filters.every(([column, value]) => row[column] === value),
        );
        return { data: rows[0] ?? null, error: null };
      },
      single: async () => {
        if (mode === "insert" && insertValue !== undefined) {
          const row = { ...insertValue };
          tableRows(table).push(row);
          return { data: row, error: null };
        }
        const rows = tableRows(table).filter((row) =>
          filters.every(([column, value]) => row[column] === value),
        );
        return { data: rows[0] ?? null, error: null };
      },
    };
    return api;
  }

  return {
    from: (table: string) => ({
      select: () => builder(table, "select"),
      insert: (values: Row) => builder(table, "insert", values),
      update: () => builder(table, "select"),
    }),
    channel: () => ({
      on: () => ({ subscribe: () => ({}) }) as never,
      subscribe: () => ({}) as never,
      unsubscribe: async () => "ok" as const,
    }),
    seed: (table: string, row: Row) => {
      tableRows(table).push(row);
    },
    forceSelectErrorOnce: (table: string, message: string) => {
      forcedSelectErrors.set(table, message);
    },
  } as unknown as FakeSupabaseClient;
}

function buildService(client: SupabaseClientLike = buildFakeSupabaseClient()): LeadsService {
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
  return new LeadsService(config, leadStore, new MessageRepository(client));
}

/**
 * AAOS-W4B: `claimLead`/`updateStatus` exercise a real `.update(...)` write-through
 * (`RecordAssignment`/`UpdateLeadStatus`), which this file's own `buildFakeSupabaseClient` above
 * doesn't persist (its `update()` ignores the new values — never exercised by the original
 * `CreateLead`/`GetLeadsByBranch` tests). `createFakeSupabaseClient` (shared test-support) DOES
 * persist updates in place, so it's used for exactly those two describe blocks below.
 */
function buildServiceWithPersistentUpdates() {
  const client = createFakeSupabaseClient();
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
  const service = new LeadsService(config, leadStore, new MessageRepository(client));
  return { service, client };
}

function seedLeadRow(overrides: Row = {}): Row {
  const now = new Date("2026-01-15T09:00:00.000Z").toISOString();
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
    status: "HOT",
    score: 80,
    temperature: "HOT",
    qual_budget: true,
    qual_unit: true,
    qual_area: true,
    qual_payment: false,
    qual_timeline: false,
    qual_name: true,
    assigned_sales_id: null,
    assigned_at: null,
    assignment_mode: null,
    first_message_at: now,
    last_message_at: now,
    became_hot_at: now,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

describe("LeadsService", () => {
  describe("createLead", () => {
    it("creates a lead via @aos/lead-store and maps it to a LeadResponseDto", async () => {
      const service = buildService();
      const dto = await service.createLead(
        {
          leadSource: LeadSource.CTWA,
          leadPhone: "+6281200000099",
          branchId: BranchId.BINTARO,
          wabaPhoneNumberId: "waba-1",
        },
        "corr-1",
      );
      expect(dto.status).toBe("NEW");
      expect(dto.leadPhone).toBe("+6281200000099");
      expect(dto.branchId).toBe(BranchId.BINTARO);
    });

    it("throws the raw @aos/lead-store error on failure", async () => {
      const service = buildService();
      await expect(
        service.createLead(
          {
            leadSource: LeadSource.CTWA,
            leadPhone: "not-a-phone",
            branchId: BranchId.BINTARO,
            wabaPhoneNumberId: "waba-1",
          },
          "corr-2",
        ),
      ).rejects.toThrow();
    });
  });

  describe("getLeadsByBranch", () => {
    it("returns an empty array when no leads exist for the branch", async () => {
      const service = buildService();
      const dtos = await service.getLeadsByBranch({ branchId: BranchId.CINERE });
      expect(dtos).toEqual([]);
    });

    it("throws the raw @aos/lead-store error when the repository lookup fails", async () => {
      const client = buildFakeSupabaseClient();
      const service = buildService(client);
      client.forceSelectErrorOnce("leads", "connection reset");
      await expect(service.getLeadsByBranch({ branchId: BranchId.CINERE })).rejects.toThrow(
        /connection reset/,
      );
    });

    it("maps every optional Lead field once populated (assignment + activity timestamps)", async () => {
      const client = buildFakeSupabaseClient();
      const service = buildService(client);
      const now = new Date("2026-01-15T09:00:00.000Z").toISOString();
      client.seed("leads", {
        id: "11111111-1111-4111-8111-111111111111",
        tenant_id: "dss-motor",
        lead_source: "CTWA",
        campaign_id: "#C047",
        ad_id: "#A001",
        ad_account_id: "act_1",
        lead_phone: "+6281200000097",
        lead_name: "Budi",
        branch_id: BranchId.UMUM,
        waba_phone_number_id: "waba-umum-1",
        status: "ASSIGNED",
        score: 70,
        temperature: "HOT",
        qual_budget: true,
        qual_unit: true,
        qual_area: true,
        qual_payment: true,
        qual_timeline: true,
        qual_name: true,
        assigned_sales_id: "22222222-2222-4222-8222-222222222222",
        assigned_at: now,
        assignment_mode: "SMART_ASSIGN",
        first_message_at: now,
        last_message_at: now,
        became_hot_at: now,
        created_at: now,
        updated_at: now,
      });

      const dtos = await service.getLeadsByBranch({ branchId: BranchId.UMUM });

      expect(dtos).toHaveLength(1);
      expect(dtos[0]?.assignedSalesId).toBe("22222222-2222-4222-8222-222222222222");
      expect(dtos[0]?.assignedAt).toBe(now);
      expect(dtos[0]?.firstMessageAt).toBe(now);
      expect(dtos[0]?.lastMessageAt).toBe(now);
      expect(dtos[0]?.becameHotAt).toBe(now);
    });

    it("returns every lead created for the branch", async () => {
      const client = buildFakeSupabaseClient();
      const service = buildService(client);
      await service.createLead(
        {
          leadSource: LeadSource.CTWA,
          leadPhone: "+6281200000098",
          branchId: BranchId.BANDUNG,
          wabaPhoneNumberId: "waba-bandung",
        },
        "corr-3",
      );
      const dtos = await service.getLeadsByBranch({ branchId: BranchId.BANDUNG });
      expect(dtos).toHaveLength(1);
      expect(dtos[0]?.branchId).toBe(BranchId.BANDUNG);
    });
  });

  it("LeadNotFoundError is exported and instanceof-checkable (sanity check on the shared error channel)", () => {
    expect(new LeadNotFoundError("x")).toBeInstanceOf(Error);
  });
});

describe("LeadsService.claimLead (AAOS-W4B)", () => {
  it("claims an unassigned lead via RecordAssignment(MANUAL) and returns it as ASSIGNED", async () => {
    const { service, client } = buildServiceWithPersistentUpdates();
    client.seed("leads", seedLeadRow());
    const dto = await service.claimLead(
      "11111111-1111-4111-8111-111111111111",
      { salesHumanId: "22222222-2222-4222-8222-222222222222" },
      "corr-claim-1",
    );
    expect(dto.status).toBe("ASSIGNED");
    expect(dto.assignedSalesId).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("returns 409 Conflict (via ConflictException) when the lead is already assigned", async () => {
    const { service, client } = buildServiceWithPersistentUpdates();
    client.seed(
      "leads",
      seedLeadRow({
        status: "ASSIGNED",
        assigned_sales_id: "99999999-9999-4999-8999-999999999999",
      }),
    );
    await expect(
      service.claimLead(
        "11111111-1111-4111-8111-111111111111",
        { salesHumanId: "22222222-2222-4222-8222-222222222222" },
        "corr-claim-2",
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("throws LeadNotFoundError when the lead does not exist", async () => {
    const { service } = buildServiceWithPersistentUpdates();
    await expect(
      service.claimLead(
        "00000000-0000-4000-8000-000000000000",
        { salesHumanId: "sales-1" },
        "corr-claim-3",
      ),
    ).rejects.toThrow(LeadNotFoundError);
  });
});

describe("LeadsService.updateStatus (AAOS-W4B)", () => {
  it("transitions a lead's status (e.g. HOT -> WARM)", async () => {
    const { service, client } = buildServiceWithPersistentUpdates();
    client.seed("leads", seedLeadRow({ status: "HOT" }));
    const dto = await service.updateStatus(
      "11111111-1111-4111-8111-111111111111",
      { status: LeadStatus.WARM },
      "corr-status-1",
    );
    expect(dto.status).toBe("WARM");
  });

  it("throws the raw @aos/lead-store error for an illegal transition (e.g. to ASSIGNED)", async () => {
    const { service, client } = buildServiceWithPersistentUpdates();
    client.seed("leads", seedLeadRow({ status: "HOT" }));
    await expect(
      service.updateStatus(
        "11111111-1111-4111-8111-111111111111",
        { status: LeadStatus.ASSIGNED },
        "corr-status-2",
      ),
    ).rejects.toThrow();
  });
});

describe("LeadsService.getMyLeads (AAOS-W4B)", () => {
  it("returns every lead assigned to the given sales human", async () => {
    const client = buildFakeSupabaseClient();
    const service = buildService(client);
    client.seed("leads", seedLeadRow({ status: "ASSIGNED", assigned_sales_id: "sales-rina" }));
    const dtos = await service.getMyLeads({ salesHumanId: "sales-rina" });
    expect(dtos).toHaveLength(1);
    expect(dtos[0]?.assignedSalesId).toBe("sales-rina");
  });

  it("returns an empty array when the sales human has no assigned leads", async () => {
    const service = buildService();
    const dtos = await service.getMyLeads({ salesHumanId: "sales-nobody" });
    expect(dtos).toEqual([]);
  });

  it("SalesHumanId is exported and usable directly (sanity check)", () => {
    expect(SalesHumanId.create("sales-1").ok).toBe(true);
  });
});

describe("LeadsService.getLeadDetail (AAOS-W4B coordinator note #2)", () => {
  it("returns the lead + qualification flags + empty messages when there is no conversation yet", async () => {
    const client = buildFakeSupabaseClient();
    const service = buildService(client);
    client.seed("leads", seedLeadRow());
    const detail = await service.getLeadDetail("11111111-1111-4111-8111-111111111111");
    expect(detail.qualification).toEqual({
      budget: true,
      unit: true,
      area: true,
      payment: false,
      timeline: false,
      name: true,
    });
    expect(detail.conversation).toBeUndefined();
    expect(detail.messages).toEqual([]);
  });

  it("returns the real conversation summary + real per-message history when a conversation exists", async () => {
    const client = buildFakeSupabaseClient();
    const service = buildService(client);
    const now = new Date("2026-01-15T09:00:00.000Z").toISOString();
    client.seed("leads", seedLeadRow());
    client.seed("conversations", {
      id: "33333333-3333-4333-8333-333333333333",
      lead_id: "11111111-1111-4111-8111-111111111111",
      branch_id: BranchId.UMUM,
      waba_phone_number_id: "waba-umum-1",
      message_count: 2,
      incoming_count: 1,
      outgoing_count: 1,
      d1_count: 1,
      d2_count: 0,
      d3_count: 0,
      d5_count: 0,
      current_stage: "QUALIFYING",
      last_intent: "ask_price",
      started_at: now,
      last_message_at: now,
      status: "ACTIVE",
    });
    client.seed("messages", {
      id: "44444444-4444-4444-8444-444444444444",
      conversation_id: "33333333-3333-4333-8333-333333333333",
      lead_id: "11111111-1111-4111-8111-111111111111",
      direction: "INCOMING",
      message_type: "TEXT",
      body: "halo kak ada Xpander gak?",
      wamid: null,
      template_name: null,
      delivery_status: null,
      sent_at: now,
      delivered_at: null,
      read_at: null,
      created_at: now,
    });
    const detail = await service.getLeadDetail("11111111-1111-4111-8111-111111111111");
    expect(detail.conversation?.currentStage).toBe("QUALIFYING");
    expect(detail.conversation?.messageCount).toBe(2);
    expect(detail.messages).toHaveLength(1);
    expect(detail.messages[0]?.body).toBe("halo kak ada Xpander gak?");
    expect(detail.messages[0]?.direction).toBe("INCOMING");
  });

  it("throws LeadNotFoundError when the lead does not exist", async () => {
    const service = buildService();
    await expect(service.getLeadDetail("00000000-0000-4000-8000-000000000000")).rejects.toThrow(
      LeadNotFoundError,
    );
  });
});
