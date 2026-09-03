import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import {
  AgentConfigRepository,
  AgentConfigRepositoryError,
  type AgentConfigRow,
} from "./agent-config.repository.js";

function seedConfig(
  client: ReturnType<typeof createFakeSupabaseClient>,
  overrides: Partial<AgentConfigRow> = {},
): void {
  client.seed("agent_configs", {
    id: "row-1",
    tenant_id: "dss-motor",
    agent: "SAMANTHA",
    config_key: "pause_cpl_multiplier",
    value: "1.5",
    data_type: "number",
    description: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    updated_by: null,
    ...overrides,
  });
}

describe("AgentConfigRepository", () => {
  describe("findByKey", () => {
    it("returns the matching row for (tenantId, agent, configKey)", async () => {
      const client = createFakeSupabaseClient();
      seedConfig(client);
      const repository = new AgentConfigRepository(client);
      const row = await repository.findByKey("dss-motor", "SAMANTHA", "pause_cpl_multiplier");
      expect(row?.value).toBe("1.5");
    });

    it("returns undefined when no row matches the tenant/agent/configKey", async () => {
      const client = createFakeSupabaseClient();
      seedConfig(client);
      const repository = new AgentConfigRepository(client);
      expect(
        await repository.findByKey("other-tenant", "SAMANTHA", "pause_cpl_multiplier"),
      ).toBeUndefined();
      expect(
        await repository.findByKey("dss-motor", "GLOBAL", "pause_cpl_multiplier"),
      ).toBeUndefined();
      expect(
        await repository.findByKey("dss-motor", "SAMANTHA", "live_run_gap_threshold"),
      ).toBeUndefined();
    });

    it("throws AgentConfigRepositoryError on a real Supabase error", async () => {
      const client = createFakeSupabaseClient();
      client.forceErrorOnce("agent_configs", "connection reset");
      const repository = new AgentConfigRepository(client);
      await expect(
        repository.findByKey("dss-motor", "SAMANTHA", "pause_cpl_multiplier"),
      ).rejects.toThrow("AgentConfigRepository.findByKey failed: connection reset");
    });
  });

  describe("upsert", () => {
    it("inserts a new row when none exists yet", async () => {
      const client = createFakeSupabaseClient();
      const repository = new AgentConfigRepository(client);
      const row = await repository.upsert({
        tenantId: "dss-motor",
        agent: "SAMANTHA",
        configKey: "pause_cpl_multiplier",
        value: "2",
        dataType: "number",
        updatedAt: "2026-08-05T00:00:00.000Z",
        updatedBy: "AI_AUTO_APPLY",
      });
      expect(row.value).toBe("2");
      expect(row.updated_by).toBe("AI_AUTO_APPLY");
      expect(client.rows("agent_configs")).toHaveLength(1);
    });

    it("updates the existing row in place (never inserts a second row) when one already exists", async () => {
      const client = createFakeSupabaseClient();
      seedConfig(client, { id: "row-1", value: "1.5" });
      const repository = new AgentConfigRepository(client);
      const row = await repository.upsert({
        tenantId: "dss-motor",
        agent: "SAMANTHA",
        configKey: "pause_cpl_multiplier",
        value: "1.8",
        dataType: "number",
        updatedAt: "2026-08-05T00:00:00.000Z",
      });
      expect(row.value).toBe("1.8");
      expect(client.rows("agent_configs")).toHaveLength(1);
    });

    it("scopes strictly to (tenantId, agent, configKey) — never touches another tenant's/agent's/key's row", async () => {
      const client = createFakeSupabaseClient();
      seedConfig(client, { id: "row-samantha", value: "1.5" });
      seedConfig(client, {
        id: "row-global",
        agent: "GLOBAL",
        config_key: "live_run_gap_threshold",
        value: "60",
      });
      const repository = new AgentConfigRepository(client);
      await repository.upsert({
        tenantId: "dss-motor",
        agent: "SAMANTHA",
        configKey: "pause_cpl_multiplier",
        value: "2",
        dataType: "number",
        updatedAt: "2026-08-05T00:00:00.000Z",
      });
      const rows = client.rows("agent_configs");
      expect(rows.find((row) => row["id"] === "row-global")?.["value"]).toBe("60");
      expect(rows).toHaveLength(2);
    });

    it("throws AgentConfigRepositoryError on a real Supabase error during insert", async () => {
      const client = createFakeSupabaseClient();
      client.forceErrorOnce("agent_configs", "connection reset");
      const repository = new AgentConfigRepository(client);
      await expect(
        repository.upsert({
          tenantId: "dss-motor",
          agent: "SAMANTHA",
          configKey: "pause_cpl_multiplier",
          value: "2",
          dataType: "number",
          updatedAt: "2026-08-05T00:00:00.000Z",
        }),
      ).rejects.toThrow(AgentConfigRepositoryError);
    });
  });
});
