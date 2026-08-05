import { describe, expect, it } from "vitest";

import { knowledgeProviderInstanceSchema } from "../../src/domain/knowledge-provider-instance.js";
import { KnowledgeProviderState } from "../../src/domain/knowledge-provider-state.js";

describe("knowledgeProviderInstanceSchema", () => {
  const base = {
    id: "i-1",
    token: "ptok_abc",
    providerId: "provider-1",
    tenantId: "tenant-1",
    state: KnowledgeProviderState.REGISTERED,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  it("accepts the minimal required shape", () => {
    expect(knowledgeProviderInstanceSchema.parse(base)).toMatchObject(base);
  });

  it("accepts optional workspaceId/connectedAt/readyAt", () => {
    const parsed = knowledgeProviderInstanceSchema.parse({
      ...base,
      workspaceId: "workspace-1",
      connectedAt: "2026-01-01T00:00:01.000Z",
      readyAt: "2026-01-01T00:00:02.000Z",
    });
    expect(parsed.workspaceId).toBe("workspace-1");
  });

  it("rejects a blank providerId", () => {
    expect(() => knowledgeProviderInstanceSchema.parse({ ...base, providerId: "" })).toThrow();
  });

  it("rejects a blank tenantId", () => {
    expect(() => knowledgeProviderInstanceSchema.parse({ ...base, tenantId: "" })).toThrow();
  });
});
