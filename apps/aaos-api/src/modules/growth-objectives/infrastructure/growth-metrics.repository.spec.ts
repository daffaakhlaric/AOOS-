import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import {
  GrowthMetricsRepository,
  GrowthMetricsRepositoryError,
} from "./growth-metrics.repository.js";

const TENANT = "propertyklik-demo";

function seedLead(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "lead-1",
    tenant_id: TENANT,
    status: "NEW",
    score: 10,
    qual_budget: false,
    qual_unit: false,
    qual_area: false,
    qual_payment: false,
    qual_timeline: false,
    qual_name: false,
    created_at: "2026-01-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("GrowthMetricsRepository", () => {
  describe("countRawLeads", () => {
    it("counts leads scoped to tenant + created_at window", async () => {
      const client = createFakeSupabaseClient();
      client.seed("leads", seedLead({ id: "l1", created_at: "2026-01-10T00:00:00.000Z" }));
      client.seed("leads", seedLead({ id: "l2", created_at: "2026-01-20T00:00:00.000Z" }));
      // Out of window
      client.seed("leads", seedLead({ id: "l3", created_at: "2025-12-01T00:00:00.000Z" }));
      // Different tenant
      client.seed(
        "leads",
        seedLead({ id: "l4", tenant_id: "other", created_at: "2026-01-10T00:00:00.000Z" }),
      );

      const repo = new GrowthMetricsRepository(client);
      const count = await repo.countRawLeads(
        TENANT,
        "2026-01-01T00:00:00.000Z",
        "2026-01-31T23:59:59.999Z",
      );
      expect(count).toBe(2);
    });

    it("returns 0 when nothing matches", async () => {
      const client = createFakeSupabaseClient();
      const repo = new GrowthMetricsRepository(client);
      const count = await repo.countRawLeads(
        TENANT,
        "2026-01-01T00:00:00.000Z",
        "2026-01-31T23:59:59.999Z",
      );
      expect(count).toBe(0);
    });

    it("throws GrowthMetricsRepositoryError on a forced Supabase error", async () => {
      const client = createFakeSupabaseClient();
      client.forceErrorOnce("leads", "boom");
      const repo = new GrowthMetricsRepository(client);
      await expect(
        repo.countRawLeads(TENANT, "2026-01-01T00:00:00.000Z", "2026-01-31T23:59:59.999Z"),
      ).rejects.toThrow(GrowthMetricsRepositoryError);
    });
  });

  describe("listLeadsForHotEvaluation", () => {
    it("maps rows to EvaluatableLead shape, scoped to tenant + window", async () => {
      const client = createFakeSupabaseClient();
      client.seed(
        "leads",
        seedLead({
          id: "l1",
          status: "HOT",
          score: 90,
          qual_budget: true,
          qual_unit: true,
          qual_area: true,
          qual_payment: true,
          qual_timeline: true,
          qual_name: true,
          created_at: "2026-01-10T00:00:00.000Z",
        }),
      );
      client.seed("leads", seedLead({ id: "l2", tenant_id: "other" }));

      const repo = new GrowthMetricsRepository(client);
      const leads = await repo.listLeadsForHotEvaluation(
        TENANT,
        "2026-01-01T00:00:00.000Z",
        "2026-01-31T23:59:59.999Z",
      );
      expect(leads).toHaveLength(1);
      expect(leads[0]).toEqual({
        status: "HOT",
        score: 90,
        qualification: {
          budget: true,
          unit: true,
          area: true,
          payment: true,
          timeline: true,
          name: true,
        },
      });
    });

    it("returns [] when nothing matches", async () => {
      const client = createFakeSupabaseClient();
      const repo = new GrowthMetricsRepository(client);
      const leads = await repo.listLeadsForHotEvaluation(
        TENANT,
        "2026-01-01T00:00:00.000Z",
        "2026-01-31T23:59:59.999Z",
      );
      expect(leads).toEqual([]);
    });

    it("throws GrowthMetricsRepositoryError on a forced Supabase error", async () => {
      const client = createFakeSupabaseClient();
      client.forceErrorOnce("leads", "boom");
      const repo = new GrowthMetricsRepository(client);
      await expect(
        repo.listLeadsForHotEvaluation(
          TENANT,
          "2026-01-01T00:00:00.000Z",
          "2026-01-31T23:59:59.999Z",
        ),
      ).rejects.toThrow(GrowthMetricsRepositoryError);
    });
  });
});
