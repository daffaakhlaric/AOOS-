import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import { PromptOverrideRepository, type PromptOverrideRow } from "./prompt-override.repository.js";

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
});
