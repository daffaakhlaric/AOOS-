import { describe, expect, it, vi } from "vitest";

import { createFakeSupabaseClient } from "../../test-support/fake-supabase-client.js";

import { AgentLogicService } from "./agent-logic.service.js";
import { AgentLogicRepository } from "./infrastructure/agent-logic.repository.js";

const FIXED_NOW = new Date("2026-09-03T12:00:00.000Z");

const WELL_FORMED_DEFINITION = [
  { conditions: [{ field: "frequency", operator: "gte", value: 3.5 }], result: "REFRESH" },
];

describe("AgentLogicService", () => {
  describe("get", () => {
    it("returns undefined when no logic row exists (real caller keeps its existing hardcoded logic)", async () => {
      const client = createFakeSupabaseClient();
      const service = new AgentLogicService(new AgentLogicRepository(client));
      const result = await service.get("dss-motor", "SAMANTHA", "verdict_classification");
      expect(result).toBeUndefined();
    });

    it("returns the real stored, well-formed ruleset when a row exists", async () => {
      const client = createFakeSupabaseClient();
      client.seed("agent_logic", {
        id: "row-1",
        tenant_id: "dss-motor",
        agent: "SAMANTHA",
        logic_key: "verdict_classification",
        definition: WELL_FORMED_DEFINITION,
        version: 1,
        score: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        updated_by: null,
      });
      const service = new AgentLogicService(new AgentLogicRepository(client));
      const result = await service.get("dss-motor", "SAMANTHA", "verdict_classification");
      expect(result).toEqual(WELL_FORMED_DEFINITION);
    });

    it("falls open to undefined (never throws) when the repository read fails", async () => {
      const client = createFakeSupabaseClient();
      const repository = new AgentLogicRepository(client);
      vi.spyOn(repository, "findByKey").mockRejectedValueOnce(new Error("boom"));
      const service = new AgentLogicService(repository);
      const result = await service.get("dss-motor", "SAMANTHA", "verdict_classification");
      expect(result).toBeUndefined();
    });

    it("falls open to undefined (never throws) when the stored definition is malformed", async () => {
      const client = createFakeSupabaseClient();
      client.seed("agent_logic", {
        id: "row-1",
        tenant_id: "dss-motor",
        agent: "SAMANTHA",
        logic_key: "verdict_classification",
        definition: { not: "an array of rules" },
        version: 1,
        score: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        updated_by: null,
      });
      const service = new AgentLogicService(new AgentLogicRepository(client));
      const result = await service.get("dss-motor", "SAMANTHA", "verdict_classification");
      expect(result).toBeUndefined();
    });

    it("does not cross-resolve a different tenant's or agent's logic", async () => {
      const client = createFakeSupabaseClient();
      client.seed("agent_logic", {
        id: "row-1",
        tenant_id: "other-tenant",
        agent: "SAMANTHA",
        logic_key: "verdict_classification",
        definition: WELL_FORMED_DEFINITION,
        version: 1,
        score: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        updated_by: null,
      });
      const service = new AgentLogicService(new AgentLogicRepository(client));
      const result = await service.get("dss-motor", "SAMANTHA", "verdict_classification");
      expect(result).toBeUndefined();
    });
  });

  describe("set", () => {
    it("upserts a real row with the given definition and a real updatedBy", async () => {
      const client = createFakeSupabaseClient();
      const service = new AgentLogicService(new AgentLogicRepository(client), () => FIXED_NOW);
      const row = await service.set(
        "dss-motor",
        "SAMANTHA",
        "verdict_classification",
        WELL_FORMED_DEFINITION,
        "AI_AUTO_APPLY",
      );
      expect(row.definition).toEqual(WELL_FORMED_DEFINITION);
      expect(row.updated_by).toBe("AI_AUTO_APPLY");
      expect(row.updated_at).toBe(FIXED_NOW.toISOString());

      const resolved = await service.get("dss-motor", "SAMANTHA", "verdict_classification");
      expect(resolved).toEqual(WELL_FORMED_DEFINITION);
    });

    it("propagates a real repository write failure (never degrades — the caller decides whether to make it best-effort)", async () => {
      const client = createFakeSupabaseClient();
      client.forceErrorOnce("agent_logic", "insert failed");
      const service = new AgentLogicService(new AgentLogicRepository(client), () => FIXED_NOW);
      await expect(
        service.set("dss-motor", "SAMANTHA", "verdict_classification", WELL_FORMED_DEFINITION),
      ).rejects.toThrow();
    });
  });
});
