import { BranchId, SalesHumanId } from "@aos/branch-manager";
import type { SupabaseClientLike } from "@aos/lead-store";
import {
  LeadNotFoundError,
  LeadSource,
  LeadStatus,
  LeadStoreFactory,
  MessageRepository,
  ScoringRepository,
} from "@aos/lead-store";
import type { WhatsAppConnector } from "@aos/whatsapp-connector";
import { describe, expect, it, vi } from "vitest";

import { toLeadStoreConfig } from "../../config/to-lead-store-config.js";
import { createFakePublisher } from "../../test-support/fake-publisher.js";
import { createFakeSupabaseClient } from "../../test-support/fake-supabase-client.js";
import { buildTestConfig } from "../../test-support/fixtures.js";
import type { WhatsAppConnectorRegistry } from "../whatsapp/infrastructure/whatsapp-connector-registry.js";

import { LeadsService } from "./leads.service.js";

/** A minimal fake `WhatsAppConnector` — only the `sendTextMessage.execute` surface `LeadsService.sendMessage`/`intervene` call. Never touches a real network. */
function buildFakeWhatsAppConnector(execute?: () => Promise<unknown>): WhatsAppConnector {
  return {
    sendTextMessage: {
      execute:
        execute ??
        vi.fn(async () => ({
          ok: true,
          value: {
            id: { toString: () => "wamid.fake-1" },
            conversationId: { toString: () => "conv-fake-1" },
            to: { toString: () => "+6281200000097" },
            from: { toString: () => "waba-umum-1" },
            branch: "UMUM",
            type: "TEXT",
            sentAt: new Date("2026-01-15T09:05:00.000Z"),
          },
        })),
    },
  } as unknown as WhatsAppConnector;
}

/** A minimal fake `WhatsAppConnectorRegistry` — `resolve()` always succeeds with the given fake connector, mirroring the real dss-motor static-fallback path every `LeadsService` test exercises (no test here needs the `ConnectorNotConfiguredError` path — see `whatsapp-connector-registry.spec.ts` for that). */
function buildFakeRegistry(connector: WhatsAppConnector): WhatsAppConnectorRegistry {
  return {
    resolve: vi.fn(async () => ({ ok: true, value: connector })),
    invalidate: vi.fn(),
  } as unknown as WhatsAppConnectorRegistry;
}

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

function buildService(
  client: SupabaseClientLike = buildFakeSupabaseClient(),
  whatsAppConnector: WhatsAppConnector = buildFakeWhatsAppConnector(),
): LeadsService {
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
  return new LeadsService(
    config,
    leadStore,
    new MessageRepository(client),
    new ScoringRepository(client),
    buildFakeRegistry(whatsAppConnector),
  );
}

/**
 * AAOS-W4B: `claimLead`/`updateStatus` exercise a real `.update(...)` write-through
 * (`RecordAssignment`/`UpdateLeadStatus`), which this file's own `buildFakeSupabaseClient` above
 * doesn't persist (its `update()` ignores the new values — never exercised by the original
 * `CreateLead`/`GetLeadsByBranch` tests). `createFakeSupabaseClient` (shared test-support) DOES
 * persist updates in place, so it's used for exactly those two describe blocks below.
 */
function buildServiceWithPersistentUpdates(
  whatsAppConnector: WhatsAppConnector = buildFakeWhatsAppConnector(),
) {
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
  const service = new LeadsService(
    config,
    leadStore,
    new MessageRepository(client),
    new ScoringRepository(client),
    buildFakeRegistry(whatsAppConnector),
  );
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

const LEAD_ID = "11111111-1111-4111-8111-111111111111";
const CONVERSATION_ID = "33333333-3333-4333-8333-333333333333";
const NOW_ISO = new Date("2026-01-15T09:00:00.000Z").toISOString();
const SALES_HUMAN_ID = "22222222-2222-4222-8222-222222222222";

function seedConversationRow(overrides: Row = {}): Row {
  return {
    id: CONVERSATION_ID,
    lead_id: LEAD_ID,
    branch_id: BranchId.UMUM,
    waba_phone_number_id: "waba-umum-1",
    message_count: 1,
    incoming_count: 1,
    outgoing_count: 0,
    d1_count: 0,
    d2_count: 0,
    d3_count: 0,
    d5_count: 0,
    current_stage: "QUALIFYING",
    last_intent: "ask_price",
    started_at: NOW_ISO,
    last_message_at: NOW_ISO,
    status: "ACTIVE",
    ...overrides,
  };
}

describe("LeadsService.getMessages (AAOS-CHAT-ROOM-JESSY coordinator note #5)", () => {
  it("returns an empty page when there is no conversation yet", async () => {
    const client = buildFakeSupabaseClient();
    const service = buildService(client);
    client.seed("leads", seedLeadRow());
    const page = await service.getMessages(LEAD_ID, { page: 1, limit: 50, order: "asc" });
    expect(page).toEqual({ messages: [], page: 1, limit: 50, total: 0 });
  });

  it("paginates the real message thread in ascending order by default", async () => {
    const client = buildFakeSupabaseClient();
    const service = buildService(client);
    client.seed("leads", seedLeadRow());
    client.seed("conversations", seedConversationRow());
    for (let i = 0; i < 3; i += 1) {
      client.seed("messages", {
        id: `4444444${i}-4444-4444-8444-444444444444`,
        conversation_id: CONVERSATION_ID,
        lead_id: LEAD_ID,
        direction: "INCOMING",
        message_type: "TEXT",
        body: `pesan ${i}`,
        wamid: null,
        template_name: null,
        delivery_status: null,
        sent_at: NOW_ISO,
        delivered_at: null,
        read_at: null,
        created_at: new Date(Date.parse(NOW_ISO) + i * 1000).toISOString(),
      });
    }
    const page1 = await service.getMessages(LEAD_ID, { page: 1, limit: 2, order: "asc" });
    expect(page1.total).toBe(3);
    expect(page1.messages).toHaveLength(2);
    expect(page1.messages[0]?.body).toBe("pesan 0");

    const page2 = await service.getMessages(LEAD_ID, { page: 2, limit: 2, order: "asc" });
    expect(page2.messages).toHaveLength(1);
    expect(page2.messages[0]?.body).toBe("pesan 2");

    const desc = await service.getMessages(LEAD_ID, { page: 1, limit: 10, order: "desc" });
    expect(desc.messages[0]?.body).toBe("pesan 2");
  });
});

describe("LeadsService.sendMessage (AAOS-CHAT-ROOM-JESSY coordinator note #5)", () => {
  it("sends via the real WhatsApp connector and persists sender_type='SALES_HUMAN'", async () => {
    const sendExecute = vi.fn(async () => ({
      ok: true,
      value: {
        id: { toString: () => "wamid.1" },
        conversationId: { toString: () => "conv-wa-1" },
        to: { toString: () => "+6281200000097" },
        from: { toString: () => "waba-umum-1" },
        branch: "UMUM",
        type: "TEXT",
        sentAt: new Date("2026-01-15T09:05:00.000Z"),
      },
    }));
    const { service, client } = buildServiceWithPersistentUpdates(
      buildFakeWhatsAppConnector(sendExecute),
    );
    client.seed("leads", seedLeadRow({ assigned_sales_id: SALES_HUMAN_ID }));
    client.seed("conversations", seedConversationRow());

    const dto = await service.sendMessage(
      LEAD_ID,
      { salesHumanId: SALES_HUMAN_ID, salesName: "Ahmad Fauzi", message: "halo pak" },
      "corr-msg-1",
    );

    expect(sendExecute).toHaveBeenCalledWith(
      expect.objectContaining({ to: "+6281200000097", body: "halo pak" }),
    );
    expect(dto.direction).toBe("OUTGOING");
    const stored = client
      .rows("messages")
      .find((row) => row["conversation_id"] === CONVERSATION_ID);
    expect(stored?.["sender_type"]).toBe("SALES_HUMAN");
    expect(stored?.["sender_name"]).toBe("Ahmad Fauzi");
  });

  it("throws ForbiddenException when salesHumanId does not match the lead's assigned sales human", async () => {
    const { service, client } = buildServiceWithPersistentUpdates();
    client.seed("leads", seedLeadRow({ assigned_sales_id: SALES_HUMAN_ID }));
    client.seed("conversations", seedConversationRow());

    await expect(
      service.sendMessage(
        LEAD_ID,
        { salesHumanId: "someone-else", salesName: "X", message: "halo" },
        "corr-msg-2",
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("throws ForbiddenException when the lead is not assigned to anyone", async () => {
    const { service, client } = buildServiceWithPersistentUpdates();
    client.seed("leads", seedLeadRow());
    client.seed("conversations", seedConversationRow());

    await expect(
      service.sendMessage(
        LEAD_ID,
        { salesHumanId: SALES_HUMAN_ID, salesName: "X", message: "halo" },
        "corr-msg-3",
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("propagates the real ConnectorNotConfiguredError honestly when the tenant has no configured WhatsApp connector", async () => {
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
    const notConfiguredError = new Error("no WhatsApp connector configured for tenant");
    const unconfiguredRegistry = {
      resolve: vi.fn(async () => ({ ok: false, error: notConfiguredError })),
      invalidate: vi.fn(),
    } as unknown as WhatsAppConnectorRegistry;
    const service = new LeadsService(
      config,
      leadStore,
      new MessageRepository(client),
      new ScoringRepository(client),
      unconfiguredRegistry,
    );
    client.seed("leads", seedLeadRow({ assigned_sales_id: SALES_HUMAN_ID }));
    client.seed("conversations", seedConversationRow());

    await expect(
      service.sendMessage(
        LEAD_ID,
        { salesHumanId: SALES_HUMAN_ID, salesName: "Ahmad Fauzi", message: "halo pak" },
        "corr-msg-4",
      ),
    ).rejects.toBe(notConfiguredError);
  });
});

describe("LeadsService.intervene (AAOS-CHAT-ROOM-JESSY coordinator note #5)", () => {
  it("sends via the real WhatsApp connector and persists sender_type='MANAGER_INTERVENTION' — honestly, never 'JESSY'", async () => {
    const { service, client } = buildServiceWithPersistentUpdates();
    client.seed("leads", seedLeadRow());
    client.seed("conversations", seedConversationRow());

    const dto = await service.intervene(
      LEAD_ID,
      { message: "halo dari Clara (manager)", managerName: "Budi (Manager)" },
      "corr-int-1",
    );

    expect(dto.direction).toBe("OUTGOING");
    const stored = client
      .rows("messages")
      .find((row) => row["conversation_id"] === CONVERSATION_ID);
    expect(stored?.["sender_type"]).toBe("MANAGER_INTERVENTION");
    expect(stored?.["sender_type"]).not.toBe("JESSY");
    expect(stored?.["sender_name"]).toBe("Budi (Manager)");
  });

  it("does not require the lead to be assigned to anyone (a manager may intervene on any lead)", async () => {
    const { service, client } = buildServiceWithPersistentUpdates();
    client.seed("leads", seedLeadRow());
    client.seed("conversations", seedConversationRow());

    await expect(
      service.intervene(LEAD_ID, { message: "halo", managerName: "Manager" }, "corr-int-2"),
    ).resolves.toBeDefined();
  });
});

describe("LeadsService.getScoringHistory (AAOS-CHAT-ROOM-JESSY coordinator note #5)", () => {
  it("returns the real scoring_events thread for a lead, in chronological order", async () => {
    const client = buildFakeSupabaseClient();
    const service = buildService(client);
    client.seed("scoring_events", {
      id: "55555555-5555-4555-8555-555555555555",
      lead_id: LEAD_ID,
      score_before: 0,
      score_after: 25,
      delta: 25,
      reason: "BUDGET",
      triggered_by: null,
      created_at: NOW_ISO,
    });
    const history = await service.getScoringHistory(LEAD_ID);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ scoreAfter: 25, delta: 25, reason: "BUDGET" });
  });

  it("returns an empty array when the lead has no scoring events", async () => {
    const service = buildService();
    const history = await service.getScoringHistory(LEAD_ID);
    expect(history).toEqual([]);
  });
});

describe("LeadsService.getAnalytics (MENU RESTRUCTURE FINAL /clara/analytics)", () => {
  it("fans out across every real branch and computes totalContacts/newContacts/active from real lead timestamps", async () => {
    const client = buildFakeSupabaseClient();
    const service = buildService(client);
    const now = new Date();
    const nowIso = now.toISOString();
    const oldIso = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

    // Has a real conversation (firstMessageAt set), created + active just now.
    client.seed(
      "leads",
      seedLeadRow({ first_message_at: nowIso, last_message_at: nowIso, created_at: nowIso }),
    );
    // No conversation yet — must NOT count toward totalContacts.
    client.seed(
      "leads",
      seedLeadRow({
        id: "55555555-5555-4555-8555-555555555555",
        first_message_at: null,
        last_message_at: null,
        created_at: oldIso,
      }),
    );

    const analytics = await service.getAnalytics({ days: 7 });

    expect(analytics.periodDays).toBe(7);
    expect(analytics.totalContacts).toBe(1);
    expect(analytics.newContacts).toBe(1);
    expect(analytics.active).toBe(1);
    expect(analytics.dailySeries).toHaveLength(7);
    expect(analytics.dailySeries.at(-1)?.date).toBe(nowIso.slice(0, 10));
  });

  it("computes avgResponseTimeMinutes/avgFirstResponseTimeMinutes by pairing real INCOMING messages with the next real OUTGOING reply", async () => {
    const client = buildFakeSupabaseClient();
    const service = buildService(client);
    const now = new Date();
    const incomingAt = now;
    const outgoingAt = new Date(now.getTime() + 5 * 60 * 1000);

    client.seed(
      "leads",
      seedLeadRow({
        first_message_at: incomingAt.toISOString(),
        last_message_at: outgoingAt.toISOString(),
        created_at: incomingAt.toISOString(),
      }),
    );
    client.seed(
      "conversations",
      seedConversationRow({ last_message_at: outgoingAt.toISOString() }),
    );
    client.seed("messages", {
      id: "66666666-6666-4666-8666-666666666666",
      conversation_id: CONVERSATION_ID,
      lead_id: LEAD_ID,
      direction: "INCOMING",
      message_type: "TEXT",
      body: "halo",
      wamid: null,
      template_name: null,
      delivery_status: null,
      sent_at: incomingAt.toISOString(),
      delivered_at: null,
      read_at: null,
      created_at: incomingAt.toISOString(),
    });
    client.seed("messages", {
      id: "77777777-7777-4777-8777-777777777777",
      conversation_id: CONVERSATION_ID,
      lead_id: LEAD_ID,
      direction: "OUTGOING",
      message_type: "TEXT",
      body: "halo juga",
      wamid: null,
      template_name: null,
      delivery_status: null,
      sent_at: outgoingAt.toISOString(),
      delivered_at: null,
      read_at: null,
      created_at: outgoingAt.toISOString(),
    });

    const analytics = await service.getAnalytics({ days: 7 });

    expect(analytics.avgResponseTimeMinutes).toBeCloseTo(5, 1);
    expect(analytics.avgFirstResponseTimeMinutes).toBeCloseTo(5, 1);
  });

  it("returns null response-time averages (never a fabricated 0) when no conversation has a reply yet", async () => {
    const service = buildService();
    const analytics = await service.getAnalytics({ days: 7 });
    expect(analytics.avgResponseTimeMinutes).toBeNull();
    expect(analytics.avgFirstResponseTimeMinutes).toBeNull();
    expect(analytics.totalContacts).toBe(0);
  });
});
