import { ConflictError } from "@aos/errors";
import { describe, expect, it, vi } from "vitest";

import { createFakeSupabaseClient } from "../../test-support/fake-supabase-client.js";

import { PromptOverrideRepository } from "./infrastructure/prompt-override.repository.js";
import { PromptOverrideService } from "./prompt-override.service.js";

const FIXED_NOW = new Date("2026-08-29T12:00:00.000Z");

function seedRow(
  client: ReturnType<typeof createFakeSupabaseClient>,
  overrides: Partial<Record<string, unknown>> = {},
): void {
  client.seed("agent_prompt_overrides", {
    id: "row-1",
    tenant_id: "dss-motor",
    agent: "SAMANTHA",
    prompt_key: "analyze",
    content: "original content",
    version: 1,
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    activated_at: "2026-01-01T00:00:00.000Z",
    deactivated_at: null,
    ...overrides,
  });
}

describe("PromptOverrideService", () => {
  describe("resolve", () => {
    it("returns the fallback unchanged when no active override row exists", async () => {
      const client = createFakeSupabaseClient();
      const service = new PromptOverrideService(new PromptOverrideRepository(client));
      const result = await service.resolve(
        "dss-motor",
        "SAMANTHA",
        "analyze",
        "the hardcoded default prompt",
      );
      expect(result).toBe("the hardcoded default prompt");
    });

    it("returns the active override's content when one exists", async () => {
      const client = createFakeSupabaseClient();
      client.seed("agent_prompt_overrides", {
        id: "row-1",
        tenant_id: "dss-motor",
        agent: "SAMANTHA",
        prompt_key: "analyze",
        content: "A tenant-specific improved analyze prompt",
        version: 2,
        is_active: true,
        created_at: "2026-01-01T00:00:00.000Z",
        activated_at: "2026-01-01T00:00:00.000Z",
        deactivated_at: null,
      });
      const service = new PromptOverrideService(new PromptOverrideRepository(client));
      const result = await service.resolve("dss-motor", "SAMANTHA", "analyze", "fallback prompt");
      expect(result).toBe("A tenant-specific improved analyze prompt");
    });

    it("falls open to the fallback (never throws) when the repository read fails", async () => {
      const client = createFakeSupabaseClient();
      const repository = new PromptOverrideRepository(client);
      vi.spyOn(repository, "findActive").mockRejectedValueOnce(new Error("boom"));
      const service = new PromptOverrideService(repository);
      const result = await service.resolve("dss-motor", "SAMANTHA", "analyze", "fallback prompt");
      expect(result).toBe("fallback prompt");
    });

    it("does not cross-resolve a different tenant's or agent's override", async () => {
      const client = createFakeSupabaseClient();
      client.seed("agent_prompt_overrides", {
        id: "row-1",
        tenant_id: "other-tenant",
        agent: "SAMANTHA",
        prompt_key: "analyze",
        content: "other tenant's override — must never leak",
        version: 1,
        is_active: true,
        created_at: "2026-01-01T00:00:00.000Z",
        activated_at: "2026-01-01T00:00:00.000Z",
        deactivated_at: null,
      });
      const service = new PromptOverrideService(new PromptOverrideRepository(client));
      const result = await service.resolve("dss-motor", "SAMANTHA", "analyze", "fallback prompt");
      expect(result).toBe("fallback prompt");
    });
  });

  describe("applyApproved", () => {
    it("deactivates the current active row and inserts a new one with version+1 and content=after (the ONLY real write path this table ever gets)", async () => {
      const client = createFakeSupabaseClient();
      seedRow(client, { id: "row-1", version: 1, is_active: true });
      const service = new PromptOverrideService(
        new PromptOverrideRepository(client),
        () => FIXED_NOW,
      );

      const result = await service.applyApproved(
        "dss-motor",
        "SAMANTHA",
        "analyze",
        "IMPROVED prompt content",
      );

      const rows = client.rows("agent_prompt_overrides");
      expect(rows).toHaveLength(2);
      const oldRow = rows.find((row) => row["id"] === "row-1");
      expect(oldRow?.["is_active"]).toBe(false);
      expect(oldRow?.["deactivated_at"]).toBe(FIXED_NOW.toISOString());

      const activeRows = rows.filter((row) => row["is_active"] === true);
      expect(activeRows).toHaveLength(1);
      expect(result.content).toBe("IMPROVED prompt content");
      expect(result.version).toBe(2);
      expect(result.is_active).toBe(true);
      expect(result.activated_at).toBe(FIXED_NOW.toISOString());
    });

    it("inserts version 1 with no prior deactivate when no active row exists yet", async () => {
      const client = createFakeSupabaseClient();
      const service = new PromptOverrideService(
        new PromptOverrideRepository(client),
        () => FIXED_NOW,
      );

      const result = await service.applyApproved(
        "dss-motor",
        "CLARA",
        "clara_system_prompt",
        "first ever override",
      );

      expect(result.version).toBe(1);
      expect(client.rows("agent_prompt_overrides")).toHaveLength(1);
    });

    it("computes the next version from the real max version across ALL rows for the key, not just the active one", async () => {
      const client = createFakeSupabaseClient();
      seedRow(client, { id: "v1", version: 1, is_active: false });
      seedRow(client, { id: "v2", version: 2, is_active: false });
      seedRow(client, { id: "v3", version: 3, is_active: true });
      const service = new PromptOverrideService(
        new PromptOverrideRepository(client),
        () => FIXED_NOW,
      );

      const result = await service.applyApproved("dss-motor", "SAMANTHA", "analyze", "v4 content");
      expect(result.version).toBe(4);
    });

    it("never leaves TWO active rows for the same (tenant, agent, promptKey), even if the insert is inspected mid-sequence", async () => {
      const client = createFakeSupabaseClient();
      seedRow(client, { id: "row-1", version: 1, is_active: true });
      const repository = new PromptOverrideRepository(client);
      const service = new PromptOverrideService(repository, () => FIXED_NOW);

      await service.applyApproved("dss-motor", "SAMANTHA", "analyze", "new content");

      const activeRows = client
        .rows("agent_prompt_overrides")
        .filter((row) => row["is_active"] === true);
      expect(activeRows).toHaveLength(1);
    });

    it("propagates the deactivate error and never inserts the new row (insert only after deactivate succeeds)", async () => {
      const client = createFakeSupabaseClient();
      seedRow(client, { id: "row-1", version: 1, is_active: true });
      const repository = new PromptOverrideRepository(client);
      vi.spyOn(repository, "deactivate").mockRejectedValueOnce(new Error("deactivate boom"));
      const service = new PromptOverrideService(repository, () => FIXED_NOW);

      await expect(
        service.applyApproved("dss-motor", "SAMANTHA", "analyze", "should never be written"),
      ).rejects.toThrow("deactivate boom");

      // Only the original seeded row exists — no new row was inserted after the failed deactivate.
      expect(client.rows("agent_prompt_overrides")).toHaveLength(1);
    });

    it("scopes strictly to the given (tenantId, agent, promptKey) — never touches another tenant's/agent's/key's active row", async () => {
      const client = createFakeSupabaseClient();
      seedRow(client, { id: "row-samantha", version: 1, is_active: true });
      seedRow(client, {
        id: "row-clara",
        agent: "CLARA",
        prompt_key: "clara_system_prompt",
        version: 1,
        is_active: true,
      });
      seedRow(client, {
        id: "row-other-tenant",
        tenant_id: "other-tenant",
        version: 1,
        is_active: true,
      });
      const service = new PromptOverrideService(
        new PromptOverrideRepository(client),
        () => FIXED_NOW,
      );

      await service.applyApproved("dss-motor", "SAMANTHA", "analyze", "new content");

      const rows = client.rows("agent_prompt_overrides");
      expect(rows.find((row) => row["id"] === "row-clara")?.["is_active"]).toBe(true);
      expect(rows.find((row) => row["id"] === "row-other-tenant")?.["is_active"]).toBe(true);
    });
  });

  describe("rollback", () => {
    it("throws ConflictError when there is no active row to roll back", async () => {
      const client = createFakeSupabaseClient();
      const service = new PromptOverrideService(
        new PromptOverrideRepository(client),
        () => FIXED_NOW,
      );
      await expect(service.rollback("dss-motor", "SAMANTHA", "analyze")).rejects.toThrow(
        ConflictError,
      );
    });

    it("deactivates the current active row and reactivates the previous version", async () => {
      const client = createFakeSupabaseClient();
      seedRow(client, {
        id: "v1",
        version: 1,
        is_active: false,
        deactivated_at: "2026-08-01T00:00:00.000Z",
      });
      seedRow(client, { id: "v2", version: 2, is_active: true });
      const service = new PromptOverrideService(
        new PromptOverrideRepository(client),
        () => FIXED_NOW,
      );

      const result = await service.rollback("dss-motor", "SAMANTHA", "analyze");

      expect(result.rolledBackToVersion).toBe(1);
      const rows = client.rows("agent_prompt_overrides");
      const v1 = rows.find((row) => row["id"] === "v1");
      const v2 = rows.find((row) => row["id"] === "v2");
      expect(v1?.["is_active"]).toBe(true);
      expect(v1?.["deactivated_at"]).toBeNull();
      expect(v1?.["activated_at"]).toBe(FIXED_NOW.toISOString());
      expect(v2?.["is_active"]).toBe(false);
      expect(v2?.["deactivated_at"]).toBe(FIXED_NOW.toISOString());
      // Never two active rows.
      expect(rows.filter((row) => row["is_active"] === true)).toHaveLength(1);
    });

    it("picks the highest version strictly below the current active one when 3+ versions exist", async () => {
      const client = createFakeSupabaseClient();
      seedRow(client, { id: "v1", version: 1, is_active: false });
      seedRow(client, { id: "v2", version: 2, is_active: false });
      seedRow(client, { id: "v3", version: 3, is_active: true });
      const service = new PromptOverrideService(
        new PromptOverrideRepository(client),
        () => FIXED_NOW,
      );

      const result = await service.rollback("dss-motor", "SAMANTHA", "analyze");
      expect(result.rolledBackToVersion).toBe(2);
      const v2 = client.rows("agent_prompt_overrides").find((row) => row["id"] === "v2");
      expect(v2?.["is_active"]).toBe(true);
    });

    it("deactivates with no new active row when the current active row was version 1 (no previous version) — falls back to the hardcoded default via resolve", async () => {
      const client = createFakeSupabaseClient();
      seedRow(client, { id: "v1", version: 1, is_active: true });
      const service = new PromptOverrideService(
        new PromptOverrideRepository(client),
        () => FIXED_NOW,
      );

      const result = await service.rollback("dss-motor", "SAMANTHA", "analyze");

      expect(result.rolledBackToVersion).toBeNull();
      const rows = client.rows("agent_prompt_overrides");
      expect(rows.filter((row) => row["is_active"] === true)).toHaveLength(0);

      // Real verification of Finding: `resolve` really does fall back to the hardcoded default
      // once no active row exists, not just an assumption.
      const resolved = await service.resolve(
        "dss-motor",
        "SAMANTHA",
        "analyze",
        "hardcoded default",
      );
      expect(resolved).toBe("hardcoded default");
    });
  });

  describe("listActiveForTenant", () => {
    it("returns only active rows for the tenant", async () => {
      const client = createFakeSupabaseClient();
      seedRow(client, { id: "active-1", is_active: true });
      seedRow(client, { id: "inactive-1", is_active: false });
      const service = new PromptOverrideService(new PromptOverrideRepository(client));
      const rows = await service.listActiveForTenant("dss-motor");
      expect(rows.map((row) => row.id)).toEqual(["active-1"]);
    });
  });
});
