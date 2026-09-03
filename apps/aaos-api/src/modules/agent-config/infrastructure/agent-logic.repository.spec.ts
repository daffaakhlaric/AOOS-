import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import {
  AgentLogicRepository,
  AgentLogicRepositoryError,
  type AgentLogicRow,
} from "./agent-logic.repository.js";

const SAMPLE_DEFINITION = [
  { conditions: [{ field: "frequency", operator: "gte", value: 3.5 }], result: "REFRESH" },
];

function seedLogic(
  client: ReturnType<typeof createFakeSupabaseClient>,
  overrides: Partial<AgentLogicRow> = {},
): void {
  client.seed("agent_logic", {
    id: "row-1",
    tenant_id: "dss-motor",
    agent: "SAMANTHA",
    logic_key: "verdict_classification",
    definition: SAMPLE_DEFINITION,
    version: 1,
    score: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    updated_by: null,
    ...overrides,
  });
}

describe("AgentLogicRepository", () => {
  describe("findByKey", () => {
    it("returns the matching row for (tenantId, agent, logicKey)", async () => {
      const client = createFakeSupabaseClient();
      seedLogic(client);
      const repository = new AgentLogicRepository(client);
      const row = await repository.findByKey("dss-motor", "SAMANTHA", "verdict_classification");
      expect(row?.definition).toEqual(SAMPLE_DEFINITION);
    });

    it("returns undefined when no row matches the tenant/agent/logicKey", async () => {
      const client = createFakeSupabaseClient();
      seedLogic(client);
      const repository = new AgentLogicRepository(client);
      expect(
        await repository.findByKey("other-tenant", "SAMANTHA", "verdict_classification"),
      ).toBeUndefined();
      expect(
        await repository.findByKey("dss-motor", "GLOBAL", "verdict_classification"),
      ).toBeUndefined();
      expect(await repository.findByKey("dss-motor", "SAMANTHA", "some_other_key")).toBeUndefined();
    });

    it("throws AgentLogicRepositoryError on a real Supabase error", async () => {
      const client = createFakeSupabaseClient();
      client.forceErrorOnce("agent_logic", "connection reset");
      const repository = new AgentLogicRepository(client);
      await expect(
        repository.findByKey("dss-motor", "SAMANTHA", "verdict_classification"),
      ).rejects.toThrow("AgentLogicRepository.findByKey failed: connection reset");
    });
  });

  describe("upsert", () => {
    it("inserts a new row (version 1) when none exists yet", async () => {
      const client = createFakeSupabaseClient();
      const repository = new AgentLogicRepository(client);
      const row = await repository.upsert({
        tenantId: "dss-motor",
        agent: "SAMANTHA",
        logicKey: "verdict_classification",
        definition: SAMPLE_DEFINITION,
        updatedAt: "2026-08-05T00:00:00.000Z",
        updatedBy: "AI_AUTO_APPLY",
      });
      expect(row.version).toBe(1);
      expect(row.updated_by).toBe("AI_AUTO_APPLY");
      expect(client.rows("agent_logic")).toHaveLength(1);
    });

    it("updates the existing row in place and increments version (never inserts a second row)", async () => {
      const client = createFakeSupabaseClient();
      seedLogic(client, { version: 1 });
      const repository = new AgentLogicRepository(client);
      const newDefinition = [
        { conditions: [{ field: "frequency", operator: "gte", value: 4 }], result: "REFRESH" },
      ];
      const row = await repository.upsert({
        tenantId: "dss-motor",
        agent: "SAMANTHA",
        logicKey: "verdict_classification",
        definition: newDefinition,
        updatedAt: "2026-08-05T00:00:00.000Z",
      });
      expect(row.definition).toEqual(newDefinition);
      expect(row.version).toBe(2);
      expect(client.rows("agent_logic")).toHaveLength(1);
    });

    it("scopes strictly to (tenantId, agent, logicKey) — never touches another tenant's/agent's/key's row", async () => {
      const client = createFakeSupabaseClient();
      seedLogic(client, { id: "row-samantha" });
      seedLogic(client, {
        id: "row-other-key",
        logic_key: "some_other_key",
        definition: [{ conditions: [{ field: "x", operator: "eq", value: 1 }], result: "R" }],
      });
      const repository = new AgentLogicRepository(client);
      await repository.upsert({
        tenantId: "dss-motor",
        agent: "SAMANTHA",
        logicKey: "verdict_classification",
        definition: SAMPLE_DEFINITION,
        updatedAt: "2026-08-05T00:00:00.000Z",
      });
      const rows = client.rows("agent_logic");
      expect(rows.find((row) => row["id"] === "row-other-key")?.["logic_key"]).toBe(
        "some_other_key",
      );
      expect(rows).toHaveLength(2);
    });

    it("throws AgentLogicRepositoryError on a real Supabase error during insert", async () => {
      const client = createFakeSupabaseClient();
      client.forceErrorOnce("agent_logic", "connection reset");
      const repository = new AgentLogicRepository(client);
      await expect(
        repository.upsert({
          tenantId: "dss-motor",
          agent: "SAMANTHA",
          logicKey: "verdict_classification",
          definition: SAMPLE_DEFINITION,
          updatedAt: "2026-08-05T00:00:00.000Z",
        }),
      ).rejects.toThrow(AgentLogicRepositoryError);
    });
  });
});
