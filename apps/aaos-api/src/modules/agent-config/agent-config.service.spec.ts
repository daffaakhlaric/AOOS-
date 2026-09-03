import { describe, expect, it, vi } from "vitest";

import { createFakeSupabaseClient } from "../../test-support/fake-supabase-client.js";

import { AgentConfigService } from "./agent-config.service.js";
import { AgentConfigRepository } from "./infrastructure/agent-config.repository.js";

const FIXED_NOW = new Date("2026-09-03T12:00:00.000Z");

describe("AgentConfigService", () => {
  describe("get", () => {
    it("returns the fallback unchanged when no config row exists", async () => {
      const client = createFakeSupabaseClient();
      const service = new AgentConfigService(new AgentConfigRepository(client));
      const result = await service.get("dss-motor", "SAMANTHA", "pause_cpl_multiplier", 1.5);
      expect(result).toBe(1.5);
    });

    it("returns the real stored numeric value when a row exists", async () => {
      const client = createFakeSupabaseClient();
      client.seed("agent_configs", {
        id: "row-1",
        tenant_id: "dss-motor",
        agent: "SAMANTHA",
        config_key: "pause_cpl_multiplier",
        value: "2.1",
        data_type: "number",
        description: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        updated_by: "manager@dss-motor.id",
      });
      const service = new AgentConfigService(new AgentConfigRepository(client));
      const result = await service.get("dss-motor", "SAMANTHA", "pause_cpl_multiplier", 1.5);
      expect(result).toBe(2.1);
    });

    it("falls open to the fallback (never throws) when the repository read fails", async () => {
      const client = createFakeSupabaseClient();
      const repository = new AgentConfigRepository(client);
      vi.spyOn(repository, "findByKey").mockRejectedValueOnce(new Error("boom"));
      const service = new AgentConfigService(repository);
      const result = await service.get("dss-motor", "SAMANTHA", "pause_cpl_multiplier", 1.5);
      expect(result).toBe(1.5);
    });

    it("falls open to the fallback (never throws) when the stored value is not a real finite number", async () => {
      const client = createFakeSupabaseClient();
      client.seed("agent_configs", {
        id: "row-1",
        tenant_id: "dss-motor",
        agent: "SAMANTHA",
        config_key: "pause_cpl_multiplier",
        value: "not-a-number",
        data_type: "number",
        description: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        updated_by: null,
      });
      const service = new AgentConfigService(new AgentConfigRepository(client));
      const result = await service.get("dss-motor", "SAMANTHA", "pause_cpl_multiplier", 1.5);
      expect(result).toBe(1.5);
    });

    it("does not cross-resolve a different tenant's or agent's config", async () => {
      const client = createFakeSupabaseClient();
      client.seed("agent_configs", {
        id: "row-1",
        tenant_id: "other-tenant",
        agent: "SAMANTHA",
        config_key: "pause_cpl_multiplier",
        value: "99",
        data_type: "number",
        description: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        updated_by: null,
      });
      const service = new AgentConfigService(new AgentConfigRepository(client));
      const result = await service.get("dss-motor", "SAMANTHA", "pause_cpl_multiplier", 1.5);
      expect(result).toBe(1.5);
    });
  });

  describe("set", () => {
    it("upserts a real row with the given numeric value stringified and a real updatedBy", async () => {
      const client = createFakeSupabaseClient();
      const service = new AgentConfigService(new AgentConfigRepository(client), () => FIXED_NOW);
      const row = await service.set(
        "dss-motor",
        "SAMANTHA",
        "pause_cpl_multiplier",
        1.8,
        "AI_AUTO_APPLY",
      );
      expect(row.value).toBe("1.8");
      expect(row.updated_by).toBe("AI_AUTO_APPLY");
      expect(row.updated_at).toBe(FIXED_NOW.toISOString());

      const resolved = await service.get("dss-motor", "SAMANTHA", "pause_cpl_multiplier", 1.5);
      expect(resolved).toBe(1.8);
    });

    it("propagates a real repository write failure (never degrades — the caller decides whether to make it best-effort)", async () => {
      const client = createFakeSupabaseClient();
      client.forceErrorOnce("agent_configs", "insert failed");
      const service = new AgentConfigService(new AgentConfigRepository(client), () => FIXED_NOW);
      await expect(
        service.set("dss-motor", "SAMANTHA", "pause_cpl_multiplier", 1.8),
      ).rejects.toThrow();
    });
  });
});
