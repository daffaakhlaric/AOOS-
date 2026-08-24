import { BranchId } from "@aos/branch-manager";
import { LeadRepository, LeadStoreFactory } from "@aos/lead-store";
import type { WhatsAppConnector } from "@aos/whatsapp-connector";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { toLeadStoreConfig } from "../../config/to-lead-store-config.js";
import { createFakePublisher } from "../../test-support/fake-publisher.js";
import {
  createFakeSupabaseClient,
  type FakeSupabaseClient,
} from "../../test-support/fake-supabase-client.js";
import { buildTestConfig } from "../../test-support/fixtures.js";
import type { WhatsAppConnectorRegistry } from "../whatsapp/infrastructure/whatsapp-connector-registry.js";

import { BroadcastLogRepository } from "./infrastructure/broadcast-log.repository.js";
import { BroadcastTemplateRepository } from "./infrastructure/broadcast-template.repository.js";
import { RecyclingSettingsRepository } from "./infrastructure/recycling-settings.repository.js";
import { RecyclingService } from "./recycling.service.js";

const NOW = new Date("2026-01-20T10:00:00.000Z"); // 17:00 WIB, inside send hours

function buildFakeWhatsAppConnector(): WhatsAppConnector {
  return {
    sendTextMessage: {
      execute: vi.fn(async () => ({
        ok: true,
        value: {
          id: { toString: () => "wamid.fake-1" },
          conversationId: { toString: () => "conv-fake-1" },
          to: { toString: () => "+6281200000097" },
          from: { toString: () => "waba-umum-1" },
          branch: "UMUM",
          type: "TEXT",
          sentAt: NOW,
        },
      })),
    },
  } as unknown as WhatsAppConnector;
}

/** A minimal fake `WhatsAppConnectorRegistry` — `resolve()` always succeeds with the given fake connector, mirroring the real dss-motor static-fallback path every `RecyclingService` test exercises. */
function buildFakeRegistry(connector: WhatsAppConnector): WhatsAppConnectorRegistry {
  return {
    resolve: vi.fn(async () => ({ ok: true, value: connector })),
    invalidate: vi.fn(),
  } as unknown as WhatsAppConnectorRegistry;
}

type Row = Record<string, unknown>;

function seedLeadRow(client: FakeSupabaseClient, overrides: Row = {}): Row {
  const createdAt = new Date("2026-01-10T00:00:00.000Z").toISOString();
  const row: Row = {
    id: overrides.id ?? "11111111-1111-4111-8111-111111111111",
    tenant_id: "dss-motor",
    lead_source: "CTWA",
    campaign_id: null,
    ad_id: null,
    ad_account_id: null,
    lead_phone: "+6281200000097",
    lead_name: "Pak Hendra",
    branch_id: BranchId.UMUM,
    waba_phone_number_id: "waba-umum-1",
    status: "WARM",
    score: 45,
    temperature: "WARM",
    qual_budget: false,
    qual_unit: false,
    qual_area: false,
    qual_payment: false,
    qual_timeline: false,
    qual_name: false,
    assigned_sales_id: null,
    assigned_at: null,
    assignment_mode: null,
    first_message_at: createdAt,
    last_message_at: createdAt,
    became_hot_at: null,
    broadcast_count: 0,
    last_broadcast_at: null,
    last_broadcast_template_id: null,
    recycling_archived: false,
    created_at: createdAt,
    updated_at: createdAt,
    ...overrides,
  };
  client.seed("leads", row);
  return row;
}

function seedTemplateRow(client: FakeSupabaseClient, overrides: Row = {}): Row {
  const row: Row = {
    id: "template-1",
    tenant_id: "dss-motor",
    name: "Promo DP Ringan",
    content: "Halo {nama}! Ada promo di {cabang}.",
    target_statuses: ["WARM", "COLD"],
    cooldown_days: 3,
    status: "ACTIVE",
    reply_rate: 20,
    hot_rate: 5,
    sent_count: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
  client.seed("broadcast_templates", row);
  return row;
}

function buildService(
  client: FakeSupabaseClient = createFakeSupabaseClient(),
  whatsAppConnector: WhatsAppConnector = buildFakeWhatsAppConnector(),
  now: () => Date = () => NOW,
): { service: RecyclingService; client: FakeSupabaseClient } {
  const config = buildTestConfig();
  const leadStoreConfigResult = toLeadStoreConfig(config);
  if (!leadStoreConfigResult.ok) {
    throw new Error("test setup failed");
  }
  const leadStore = LeadStoreFactory.create({
    config: leadStoreConfigResult.value,
    publisher: createFakePublisher(),
    supabaseClient: client,
  });
  const service = new RecyclingService(
    config,
    leadStore,
    new LeadRepository(client),
    buildFakeRegistry(whatsAppConnector),
    new BroadcastTemplateRepository(client),
    new BroadcastLogRepository(client),
    new RecyclingSettingsRepository(client),
    now,
  );
  return { service, client };
}

describe("RecyclingService.getPool", () => {
  it("returns only leads that pass isInRecyclingPool, across every branch", async () => {
    const client = createFakeSupabaseClient();
    seedLeadRow(client, { id: "lead-warm", branch_id: BranchId.UMUM, status: "WARM", score: 45 });
    seedLeadRow(client, {
      id: "lead-hot",
      branch_id: BranchId.BINTARO,
      status: "HOT",
      score: 80,
      temperature: "HOT",
    });
    const { service } = buildService(client);
    const pool = await service.getPool();
    expect(pool.map((l) => l.id.toString())).toEqual(["lead-warm"]);
  });
});

describe("RecyclingService templates/auto-mode", () => {
  it("createTemplate + listTemplates round-trips through the real repository", async () => {
    const { service } = buildService();
    await service.createTemplate({
      name: "Promo DP Ringan",
      content: "Halo {nama}!",
      targetStatuses: ["WARM"],
      cooldownDays: 3,
      status: "ACTIVE",
    });
    const templates = await service.listTemplates();
    expect(templates).toHaveLength(1);
    expect(templates[0]?.name).toBe("Promo DP Ringan");
  });

  it("getAutoMode defaults true, setAutoMode persists false", async () => {
    const { service } = buildService();
    expect(await service.getAutoMode()).toBe(true);
    await service.setAutoMode(false);
    expect(await service.getAutoMode()).toBe(false);
  });
});

describe("RecyclingService.broadcastToLead", () => {
  it("sends via the real sendTextMessage path, logs, and updates the lead's broadcast fields", async () => {
    const client = createFakeSupabaseClient();
    seedLeadRow(client);
    seedTemplateRow(client);
    const whatsAppConnector = buildFakeWhatsAppConnector();
    const { service } = buildService(client, whatsAppConnector);

    const result = await service.broadcastToLead(
      "11111111-1111-4111-8111-111111111111",
      "template-1",
      "corr-1",
    );

    expect(whatsAppConnector.sendTextMessage.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "+6281200000097",
        body: expect.stringContaining("Pak Hendra"),
      }),
    );
    expect(result.templateId).toBe("template-1");
    expect(client.rows("broadcast_logs")).toHaveLength(1);

    const updatedLead = client
      .rows("leads")
      .find((r) => r.id === "11111111-1111-4111-8111-111111111111");
    expect(updatedLead?.broadcast_count).toBe(1);
    expect(updatedLead?.last_broadcast_template_id).toBe("template-1");
    expect(updatedLead?.recycling_archived).toBe(false);

    const template = client.rows("broadcast_templates").find((r) => r.id === "template-1");
    expect(template?.sent_count).toBe(1);
  });

  it("archives the lead once broadcastCount reaches maxBroadcastCount (3)", async () => {
    const client = createFakeSupabaseClient();
    seedLeadRow(client, { broadcast_count: 2 });
    seedTemplateRow(client);
    const { service } = buildService(client);

    await service.broadcastToLead("11111111-1111-4111-8111-111111111111", "template-1", "corr-1");

    const updatedLead = client
      .rows("leads")
      .find((r) => r.id === "11111111-1111-4111-8111-111111111111");
    expect(updatedLead?.broadcast_count).toBe(3);
    expect(updatedLead?.recycling_archived).toBe(true);
  });

  it("throws NotFoundError for a missing lead", async () => {
    const client = createFakeSupabaseClient();
    seedTemplateRow(client);
    const { service } = buildService(client);
    await expect(service.broadcastToLead("missing-lead", "template-1", "corr-1")).rejects.toThrow();
  });

  it("throws NotFoundError for a missing template", async () => {
    const client = createFakeSupabaseClient();
    seedLeadRow(client);
    const { service } = buildService(client);
    await expect(
      service.broadcastToLead("11111111-1111-4111-8111-111111111111", "missing-template", "corr-1"),
    ).rejects.toThrow();
  });
});

describe("RecyclingService.broadcastAll / runRecyclingRun", () => {
  it("sends to every ready lead using selectBestTemplate, skipping leads with no matching template", async () => {
    const client = createFakeSupabaseClient();
    seedLeadRow(client, { id: "lead-warm", branch_id: BranchId.UMUM, status: "WARM" });
    seedLeadRow(client, {
      id: "lead-cold-no-template",
      branch_id: BranchId.BINTARO,
      lead_phone: "+6281200000098",
      status: "COLD",
      score: 20,
      temperature: "COLD",
    });
    seedTemplateRow(client, { id: "template-warm-only", target_statuses: ["WARM"] });
    const { service } = buildService(client);

    const result = await service.broadcastAll("corr-1");

    expect(result.attempted).toBe(2);
    expect(result.sent).toHaveLength(1);
    expect(result.sent[0]?.leadId).toBe("lead-warm");
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.leadId).toBe("lead-cold-no-template");
  });

  it("excludes a template already sent to this lead", async () => {
    const client = createFakeSupabaseClient();
    seedLeadRow(client);
    seedTemplateRow(client);
    client.seed("broadcast_logs", {
      id: "log-existing",
      tenant_id: "dss-motor",
      lead_id: "11111111-1111-4111-8111-111111111111",
      template_id: "template-1",
      message_sent: "already sent",
      status: "SENT",
      sent_at: "2026-01-15T08:00:00.000Z",
      delivered_at: null,
      read_at: null,
      replied: false,
      replied_at: null,
      converted_to_hot: false,
      converted_at: null,
    });
    const { service } = buildService(client);

    const result = await service.broadcastAll("corr-1");
    expect(result.sent).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
  });

  it("runRecyclingRun with Auto Mode OFF returns an honest no-op summary and sends nothing", async () => {
    const client = createFakeSupabaseClient();
    seedLeadRow(client);
    seedTemplateRow(client);
    const whatsAppConnector = buildFakeWhatsAppConnector();
    const { service } = buildService(client, whatsAppConnector);
    await service.setAutoMode(false);

    const result = await service.runRecyclingRun("corr-1");
    expect(result.summary).toBe("Auto Mode OFF, tidak ada broadcast dikirim");
    expect(result.sent).toBe(0);
    expect(whatsAppConnector.sendTextMessage.execute).not.toHaveBeenCalled();
  });

  it("runRecyclingRun with Auto Mode ON (default) sends real broadcasts and reports a real summary", async () => {
    const client = createFakeSupabaseClient();
    seedLeadRow(client);
    seedTemplateRow(client);
    const { service } = buildService(client);

    const result = await service.runRecyclingRun("corr-1");
    expect(result.summary).toContain("broadcast terkirim");
    expect(result.sent).toBe(1);
  });
});

describe("RecyclingService.getLogs", () => {
  it("delegates to BroadcastLogRepository.listByTenant", async () => {
    const client = createFakeSupabaseClient();
    client.seed("broadcast_logs", {
      id: "log-1",
      tenant_id: "dss-motor",
      lead_id: "lead-1",
      template_id: "template-1",
      message_sent: "hi",
      status: "SENT",
      sent_at: "2026-01-15T08:00:00.000Z",
      delivered_at: null,
      read_at: null,
      replied: false,
      replied_at: null,
      converted_to_hot: false,
      converted_at: null,
    });
    const { service } = buildService(client);
    const logs = await service.getLogs(200);
    expect(logs).toHaveLength(1);
  });
});

describe("RecyclingService constructor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("constructs without throwing given every real dependency", () => {
    expect(() => buildService()).not.toThrow();
  });
});
