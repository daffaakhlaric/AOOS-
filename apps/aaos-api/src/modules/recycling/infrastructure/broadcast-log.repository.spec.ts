import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import { BroadcastLogRepository, BroadcastLogRepositoryError } from "./broadcast-log.repository.js";

describe("BroadcastLogRepository", () => {
  it("inserts a row, defaulting status/replied/converted fields", async () => {
    const client = createFakeSupabaseClient();
    const repo = new BroadcastLogRepository(client);
    const row = await repo.insert({
      tenant_id: "dss-motor",
      lead_id: "lead-1",
      template_id: "t-1",
      message_sent: "Halo Pak Hendra!",
    });
    expect(row.status).toBe("SENT");
    expect(row.replied).toBe(false);
    expect(row.converted_to_hot).toBe(false);
    expect(row.replied_at).toBeNull();
  });

  it("listByTenant returns only that tenant's logs, most recent first", async () => {
    const client = createFakeSupabaseClient();
    client.seed("broadcast_logs", {
      id: "log-1",
      tenant_id: "dss-motor",
      lead_id: "lead-1",
      template_id: "t-1",
      message_sent: "a",
      status: "SENT",
      sent_at: "2026-01-15T08:00:00.000Z",
      delivered_at: null,
      read_at: null,
      replied: false,
      replied_at: null,
      converted_to_hot: false,
      converted_at: null,
    });
    client.seed("broadcast_logs", {
      id: "log-2",
      tenant_id: "dss-motor",
      lead_id: "lead-2",
      template_id: "t-1",
      message_sent: "b",
      status: "SENT",
      sent_at: "2026-01-16T08:00:00.000Z",
      delivered_at: null,
      read_at: null,
      replied: false,
      replied_at: null,
      converted_to_hot: false,
      converted_at: null,
    });
    client.seed("broadcast_logs", {
      id: "log-3",
      tenant_id: "other-tenant",
      lead_id: "lead-3",
      template_id: "t-1",
      message_sent: "c",
      status: "SENT",
      sent_at: "2026-01-17T08:00:00.000Z",
      delivered_at: null,
      read_at: null,
      replied: false,
      replied_at: null,
      converted_to_hot: false,
      converted_at: null,
    });
    const repo = new BroadcastLogRepository(client);
    const rows = await repo.listByTenant("dss-motor");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.id).toBe("log-2"); // most recent first
  });

  it("listByLead returns only that lead's logs", async () => {
    const client = createFakeSupabaseClient();
    client.seed("broadcast_logs", {
      id: "log-1",
      tenant_id: "dss-motor",
      lead_id: "lead-1",
      template_id: "t-1",
      message_sent: "a",
      status: "SENT",
      sent_at: "2026-01-15T08:00:00.000Z",
      delivered_at: null,
      read_at: null,
      replied: false,
      replied_at: null,
      converted_to_hot: false,
      converted_at: null,
    });
    const repo = new BroadcastLogRepository(client);
    const rows = await repo.listByLead("lead-1");
    expect(rows).toHaveLength(1);
  });

  it("markReplied sets replied=true and replied_at", async () => {
    const client = createFakeSupabaseClient();
    client.seed("broadcast_logs", {
      id: "log-1",
      tenant_id: "dss-motor",
      lead_id: "lead-1",
      template_id: "t-1",
      message_sent: "a",
      status: "SENT",
      sent_at: "2026-01-15T08:00:00.000Z",
      delivered_at: null,
      read_at: null,
      replied: false,
      replied_at: null,
      converted_to_hot: false,
      converted_at: null,
    });
    const repo = new BroadcastLogRepository(client);
    await repo.markReplied("log-1", "2026-01-16T09:00:00.000Z");
    const rows = await repo.listByLead("lead-1");
    expect(rows[0]?.replied).toBe(true);
    expect(rows[0]?.replied_at).toBe("2026-01-16T09:00:00.000Z");
    expect(rows[0]?.converted_to_hot).toBe(false); // markReplied never touches this
  });

  it("throws BroadcastLogRepositoryError on a forced Supabase error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("broadcast_logs", "boom");
    const repo = new BroadcastLogRepository(client);
    await expect(repo.listByTenant("dss-motor")).rejects.toThrow(BroadcastLogRepositoryError);
  });

  describe("getTodaySummary", () => {
    const TODAY_START_ISO = "2026-01-15T00:00:00.000Z";

    it("returns 0/0 when there are zero real logs for this tenant", async () => {
      const client = createFakeSupabaseClient();
      const repo = new BroadcastLogRepository(client);
      const summary = await repo.getTodaySummary("dss-motor", TODAY_START_ISO);
      expect(summary).toEqual({ sentToday: 0, respondedToday: 0 });
    });

    it("counts sentToday by real sent_at >= sinceISO and respondedToday by real replied/replied_at >= sinceISO independently", async () => {
      const client = createFakeSupabaseClient();
      // Sent today, not yet replied.
      client.seed("broadcast_logs", {
        id: "log-1",
        tenant_id: "dss-motor",
        lead_id: "lead-1",
        template_id: "t-1",
        message_sent: "a",
        status: "SENT",
        sent_at: "2026-01-15T08:00:00.000Z",
        delivered_at: null,
        read_at: null,
        replied: false,
        replied_at: null,
        converted_to_hot: false,
        converted_at: null,
      });
      // Sent YESTERDAY, but replied TODAY — respondedToday must count it even though sentToday doesn't.
      client.seed("broadcast_logs", {
        id: "log-2",
        tenant_id: "dss-motor",
        lead_id: "lead-2",
        template_id: "t-1",
        message_sent: "b",
        status: "SENT",
        sent_at: "2026-01-14T08:00:00.000Z",
        delivered_at: null,
        read_at: null,
        replied: true,
        replied_at: "2026-01-15T09:00:00.000Z",
        converted_to_hot: false,
        converted_at: null,
      });
      // A different tenant's log sent today — must not be counted.
      client.seed("broadcast_logs", {
        id: "log-3",
        tenant_id: "other-tenant",
        lead_id: "lead-3",
        template_id: "t-1",
        message_sent: "c",
        status: "SENT",
        sent_at: "2026-01-15T08:00:00.000Z",
        delivered_at: null,
        read_at: null,
        replied: false,
        replied_at: null,
        converted_to_hot: false,
        converted_at: null,
      });
      // Sent yesterday, never replied — counted in neither.
      client.seed("broadcast_logs", {
        id: "log-4",
        tenant_id: "dss-motor",
        lead_id: "lead-4",
        template_id: "t-1",
        message_sent: "d",
        status: "SENT",
        sent_at: "2026-01-14T08:00:00.000Z",
        delivered_at: null,
        read_at: null,
        replied: false,
        replied_at: null,
        converted_to_hot: false,
        converted_at: null,
      });

      const repo = new BroadcastLogRepository(client);
      const summary = await repo.getTodaySummary("dss-motor", TODAY_START_ISO);
      expect(summary).toEqual({ sentToday: 1, respondedToday: 1 });
    });

    it("throws BroadcastLogRepositoryError on a forced Supabase error", async () => {
      const client = createFakeSupabaseClient();
      client.forceErrorOnce("broadcast_logs", "boom");
      const repo = new BroadcastLogRepository(client);
      await expect(repo.getTodaySummary("dss-motor", TODAY_START_ISO)).rejects.toThrow(
        BroadcastLogRepositoryError,
      );
    });
  });
});
