import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import {
  PromptOverrideRepository,
  PromptOverrideRepositoryError,
  type PromptOverrideRow,
} from "./prompt-override.repository.js";

function seedOverride(
  client: ReturnType<typeof createFakeSupabaseClient>,
  overrides: Partial<PromptOverrideRow> = {},
): void {
  client.seed("agent_prompt_overrides", {
    id: "row-1",
    tenant_id: "dss-motor",
    agent: "SAMANTHA",
    prompt_key: "analyze",
    content: "Custom analyze prompt",
    version: 1,
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    activated_at: "2026-01-01T00:00:00.000Z",
    deactivated_at: null,
    ...overrides,
  });
}

describe("PromptOverrideRepository", () => {
  describe("findActive", () => {
    it("returns the active row for (tenantId, agent, promptKey)", async () => {
      const client = createFakeSupabaseClient();
      seedOverride(client);
      const repository = new PromptOverrideRepository(client);
      const row = await repository.findActive("dss-motor", "SAMANTHA", "analyze");
      expect(row?.content).toBe("Custom analyze prompt");
    });

    it("returns undefined when no row matches the tenant/agent/promptKey", async () => {
      const client = createFakeSupabaseClient();
      seedOverride(client);
      const repository = new PromptOverrideRepository(client);
      expect(await repository.findActive("other-tenant", "SAMANTHA", "analyze")).toBeUndefined();
      expect(await repository.findActive("dss-motor", "CLARA", "analyze")).toBeUndefined();
      expect(
        await repository.findActive("dss-motor", "SAMANTHA", "creative_brief"),
      ).toBeUndefined();
    });

    it("returns undefined for a row that exists but is not active", async () => {
      const client = createFakeSupabaseClient();
      seedOverride(client, { is_active: false, deactivated_at: "2026-02-01T00:00:00.000Z" });
      const repository = new PromptOverrideRepository(client);
      expect(await repository.findActive("dss-motor", "SAMANTHA", "analyze")).toBeUndefined();
    });

    it("throws PromptOverrideRepositoryError on a real Supabase error", async () => {
      const client = createFakeSupabaseClient();
      client.forceErrorOnce("agent_prompt_overrides", "connection reset");
      const repository = new PromptOverrideRepository(client);
      await expect(repository.findActive("dss-motor", "SAMANTHA", "analyze")).rejects.toThrow(
        "PromptOverrideRepository.findActive failed: connection reset",
      );
    });
  });

  describe("listVersions", () => {
    it("returns every row (active or not) for the (tenant, agent, promptKey)", async () => {
      const client = createFakeSupabaseClient();
      seedOverride(client, { id: "v1", version: 1, is_active: false });
      seedOverride(client, { id: "v2", version: 2, is_active: true });
      seedOverride(client, { id: "other-tenant", tenant_id: "other-tenant", version: 1 });
      const repository = new PromptOverrideRepository(client);
      const rows = await repository.listVersions("dss-motor", "SAMANTHA", "analyze");
      expect(rows.map((row) => row.id).sort()).toEqual(["v1", "v2"]);
    });

    it("throws PromptOverrideRepositoryError on a real Supabase error", async () => {
      const client = createFakeSupabaseClient();
      client.forceErrorOnce("agent_prompt_overrides", "connection reset");
      const repository = new PromptOverrideRepository(client);
      await expect(repository.listVersions("dss-motor", "SAMANTHA", "analyze")).rejects.toThrow(
        PromptOverrideRepositoryError,
      );
    });
  });

  describe("listActiveForTenant", () => {
    it("returns only active rows for the tenant, any agent/promptKey", async () => {
      const client = createFakeSupabaseClient();
      seedOverride(client, { id: "active-1", is_active: true });
      seedOverride(client, {
        id: "active-2",
        agent: "CLARA",
        prompt_key: "clara_system_prompt",
        is_active: true,
      });
      seedOverride(client, { id: "inactive-1", is_active: false });
      seedOverride(client, { id: "other-tenant", tenant_id: "other-tenant", is_active: true });
      const repository = new PromptOverrideRepository(client);
      const rows = await repository.listActiveForTenant("dss-motor");
      expect(rows.map((row) => row.id).sort()).toEqual(["active-1", "active-2"]);
    });

    it("throws PromptOverrideRepositoryError on a real Supabase error", async () => {
      const client = createFakeSupabaseClient();
      client.forceErrorOnce("agent_prompt_overrides", "connection reset");
      const repository = new PromptOverrideRepository(client);
      await expect(repository.listActiveForTenant("dss-motor")).rejects.toThrow(
        PromptOverrideRepositoryError,
      );
    });
  });

  describe("deactivate", () => {
    it("sets is_active=false and deactivated_at on the matching row only", async () => {
      const client = createFakeSupabaseClient();
      seedOverride(client, { id: "row-1", is_active: true });
      seedOverride(client, { id: "row-2", is_active: true, prompt_key: "creative_brief" });
      const repository = new PromptOverrideRepository(client);
      await repository.deactivate("row-1", "2026-08-05T00:00:00.000Z");
      const rows = client.rows("agent_prompt_overrides");
      const row1 = rows.find((row) => row["id"] === "row-1");
      const row2 = rows.find((row) => row["id"] === "row-2");
      expect(row1?.["is_active"]).toBe(false);
      expect(row1?.["deactivated_at"]).toBe("2026-08-05T00:00:00.000Z");
      expect(row2?.["is_active"]).toBe(true);
    });

    it("throws PromptOverrideRepositoryError on a real Supabase error", async () => {
      const client = createFakeSupabaseClient();
      client.forceErrorOnce("agent_prompt_overrides", "connection reset");
      const repository = new PromptOverrideRepository(client);
      await expect(repository.deactivate("row-1", "2026-08-05T00:00:00.000Z")).rejects.toThrow(
        PromptOverrideRepositoryError,
      );
    });
  });

  describe("reactivate", () => {
    it("sets is_active=true, refreshes activated_at, and clears deactivated_at", async () => {
      const client = createFakeSupabaseClient();
      seedOverride(client, {
        id: "row-1",
        is_active: false,
        deactivated_at: "2026-08-01T00:00:00.000Z",
      });
      const repository = new PromptOverrideRepository(client);
      await repository.reactivate("row-1", "2026-08-05T00:00:00.000Z");
      const row = client.rows("agent_prompt_overrides")[0];
      expect(row?.["is_active"]).toBe(true);
      expect(row?.["activated_at"]).toBe("2026-08-05T00:00:00.000Z");
      expect(row?.["deactivated_at"]).toBeNull();
    });

    it("throws PromptOverrideRepositoryError on a real Supabase error", async () => {
      const client = createFakeSupabaseClient();
      client.forceErrorOnce("agent_prompt_overrides", "connection reset");
      const repository = new PromptOverrideRepository(client);
      await expect(repository.reactivate("row-1", "2026-08-05T00:00:00.000Z")).rejects.toThrow(
        PromptOverrideRepositoryError,
      );
    });
  });

  describe("insert", () => {
    it("inserts a new, already-active row", async () => {
      const client = createFakeSupabaseClient();
      const repository = new PromptOverrideRepository(client);
      const row = await repository.insert({
        tenantId: "dss-motor",
        agent: "SAMANTHA",
        promptKey: "analyze",
        content: "New content",
        version: 2,
        activatedAt: "2026-08-05T00:00:00.000Z",
      });
      expect(row.content).toBe("New content");
      expect(row.version).toBe(2);
      expect(row.is_active).toBe(true);
      expect(client.rows("agent_prompt_overrides")).toHaveLength(1);
    });

    it("throws PromptOverrideRepositoryError on a real Supabase error", async () => {
      const client = createFakeSupabaseClient();
      client.forceErrorOnce("agent_prompt_overrides", "connection reset");
      const repository = new PromptOverrideRepository(client);
      await expect(
        repository.insert({
          tenantId: "dss-motor",
          agent: "SAMANTHA",
          promptKey: "analyze",
          content: "x",
          version: 1,
          activatedAt: "2026-08-05T00:00:00.000Z",
        }),
      ).rejects.toThrow(PromptOverrideRepositoryError);
    });
  });
});
