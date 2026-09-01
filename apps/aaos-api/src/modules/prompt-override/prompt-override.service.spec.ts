import { describe, expect, it, vi } from "vitest";

import { createFakeSupabaseClient } from "../../test-support/fake-supabase-client.js";

import { PromptOverrideRepository } from "./infrastructure/prompt-override.repository.js";
import { PromptOverrideService } from "./prompt-override.service.js";

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
});
