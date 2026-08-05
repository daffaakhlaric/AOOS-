import { describe, expect, it } from "vitest";

import { knowledgeSourcePermissionGrantSchema } from "../../src/permission/knowledge-source-permission-grant.js";

describe("knowledgeSourcePermissionGrantSchema", () => {
  it("accepts a minimal allow grant", () => {
    expect(() =>
      knowledgeSourcePermissionGrantSchema.parse({
        id: "grant-1",
        scope: { tenantId: "tenant-1" },
        effect: "allow",
        createdAt: new Date().toISOString(),
      }),
    ).not.toThrow();
  });

  it("rejects an invalid effect", () => {
    expect(() =>
      knowledgeSourcePermissionGrantSchema.parse({
        id: "grant-1",
        scope: { tenantId: "tenant-1" },
        effect: "maybe",
        createdAt: new Date().toISOString(),
      }),
    ).toThrow();
  });
});
