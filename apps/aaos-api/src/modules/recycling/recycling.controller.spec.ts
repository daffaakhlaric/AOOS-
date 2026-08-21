import "reflect-metadata";

import { LeadBuilder } from "@aos/lead-store";
import { describe, expect, it, vi } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import type { BroadcastLogRow } from "./infrastructure/broadcast-log.repository.js";
import type { BroadcastTemplateRow } from "./infrastructure/broadcast-template.repository.js";
import { RecyclingController } from "./recycling.controller.js";
import type { RecyclingService } from "./recycling.service.js";

function unwrap<T>(result: { ok: boolean; value?: T }): T {
  if (!result.ok) {
    throw new Error("test lead build failed");
  }
  return result.value as T;
}

function buildFakeTemplate(overrides: Partial<BroadcastTemplateRow> = {}): BroadcastTemplateRow {
  return {
    id: "template-1",
    tenant_id: "dss-motor",
    name: "Promo DP Ringan",
    content: "Halo {nama}!",
    target_statuses: ["WARM"],
    cooldown_days: 3,
    status: "ACTIVE",
    reply_rate: 20,
    hot_rate: 5,
    sent_count: 3,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function buildFakeLog(overrides: Partial<BroadcastLogRow> = {}): BroadcastLogRow {
  return {
    id: "log-1",
    tenant_id: "dss-motor",
    lead_id: "lead-1",
    template_id: "template-1",
    message_sent: "Halo!",
    status: "SENT",
    sent_at: "2026-01-15T08:00:00.000Z",
    delivered_at: null,
    read_at: null,
    replied: false,
    replied_at: null,
    converted_to_hot: false,
    converted_at: null,
    ...overrides,
  };
}

function buildFakeService(): RecyclingService {
  const lead = unwrap(new LeadBuilder().withLeadName("Pak Hendra").build());
  return {
    getPool: vi.fn(async () => [lead]),
    isReadyToSendNow: vi.fn(() => true),
    listTemplates: vi.fn(async () => [buildFakeTemplate()]),
    createTemplate: vi.fn(async () => buildFakeTemplate()),
    updateTemplate: vi.fn(async () => buildFakeTemplate({ status: "INACTIVE" })),
    broadcastToLead: vi.fn(async () => ({
      leadId: "lead-1",
      templateId: "template-1",
      broadcastLogId: "log-1",
      sentAt: "2026-01-15T08:00:00.000Z",
    })),
    broadcastAll: vi.fn(async () => ({ attempted: 1, sent: [], failed: [] })),
    getLogs: vi.fn(async () => [buildFakeLog()]),
    getAutoMode: vi.fn(async () => true),
    setAutoMode: vi.fn(async () => undefined),
  } as unknown as RecyclingService;
}

describe("RecyclingController", () => {
  it("GET /pool maps every pool lead through toRecyclingPoolLeadResponseDto with readyToSend", async () => {
    const service = buildFakeService();
    const controller = new RecyclingController(service);
    const result = await controller.getPool();
    expect(result).toHaveLength(1);
    expect(result[0]?.leadName).toBe("Pak Hendra");
    expect(result[0]?.readyToSend).toBe(true);
  });

  it("GET /templates delegates to RecyclingService.listTemplates", async () => {
    const service = buildFakeService();
    const controller = new RecyclingController(service);
    const result = await controller.listTemplates();
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Promo DP Ringan");
  });

  it("POST /templates delegates to RecyclingService.createTemplate with the body", async () => {
    const service = buildFakeService();
    const controller = new RecyclingController(service);
    const body = {
      name: "Promo DP Ringan",
      content: "Halo {nama}!",
      targetStatuses: ["WARM" as const],
      cooldownDays: 3,
      status: "ACTIVE" as const,
    };
    await controller.createTemplate(body);
    expect(service.createTemplate).toHaveBeenCalledWith(body);
  });

  it("PUT /templates/:id delegates to RecyclingService.updateTemplate", async () => {
    const service = buildFakeService();
    const controller = new RecyclingController(service);
    const result = await controller.updateTemplate("template-1", { status: "INACTIVE" });
    expect(service.updateTemplate).toHaveBeenCalledWith("template-1", { status: "INACTIVE" });
    expect(result.status).toBe("INACTIVE");
  });

  it("POST /broadcast/:leadId delegates with leadId, templateId, and correlation id", async () => {
    const service = buildFakeService();
    const controller = new RecyclingController(service);
    const result = await controller.broadcastToLead(
      "lead-1",
      { templateId: "template-1" },
      "corr-1",
    );
    expect(service.broadcastToLead).toHaveBeenCalledWith("lead-1", "template-1", "corr-1");
    expect(result.broadcastLogId).toBe("log-1");
  });

  it("POST /broadcast-all delegates with a correlation id", async () => {
    const service = buildFakeService();
    const controller = new RecyclingController(service);
    await controller.broadcastAll("corr-1");
    expect(service.broadcastAll).toHaveBeenCalledWith("corr-1");
  });

  it("GET /logs delegates to RecyclingService.getLogs with the query limit", async () => {
    const service = buildFakeService();
    const controller = new RecyclingController(service);
    const result = await controller.getLogs({ limit: 50 });
    expect(service.getLogs).toHaveBeenCalledWith(50);
    expect(result).toHaveLength(1);
  });

  it("GET /auto-mode returns the real current flag", async () => {
    const service = buildFakeService();
    const controller = new RecyclingController(service);
    expect(await controller.getAutoMode()).toEqual({ autoMode: true });
  });

  it("POST /auto-mode persists and echoes the new flag", async () => {
    const service = buildFakeService();
    const controller = new RecyclingController(service);
    const result = await controller.setAutoMode({ autoMode: false });
    expect(service.setAutoMode).toHaveBeenCalledWith(false);
    expect(result).toEqual({ autoMode: false });
  });

  it("guards the whole controller with ApiKeyGuard", () => {
    const guards = Reflect.getMetadata("__guards__", RecyclingController) as unknown[];
    expect(guards).toContain(ApiKeyGuard);
  });
});
