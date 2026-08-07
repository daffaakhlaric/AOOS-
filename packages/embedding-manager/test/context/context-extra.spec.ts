import { describe, expect, it } from "vitest";

import { createEmbeddingContext } from "../../src/context/create-embedding-context.js";

describe("createEmbeddingContext — extra field scenarios", () => {
  it("two contexts created without explicit tokens get different tokens", () => {
    const a = createEmbeddingContext({ embeddingId: "e-1", tenantId: "tenant-1" });
    const b = createEmbeddingContext({ embeddingId: "e-1", tenantId: "tenant-1" });
    expect(a.token).not.toBe(b.token);
  });

  it("two contexts created without explicit correlationId get different correlationIds", () => {
    const a = createEmbeddingContext({ embeddingId: "e-1", tenantId: "tenant-1" });
    const b = createEmbeddingContext({ embeddingId: "e-1", tenantId: "tenant-1" });
    expect(a.correlationId).not.toBe(b.correlationId);
  });

  it("embeddingId and tenantId are required and passed through verbatim", () => {
    const context = createEmbeddingContext({ embeddingId: "e-99", tenantId: "tenant-99" });
    expect(context.embeddingId).toBe("e-99");
    expect(context.tenantId).toBe("tenant-99");
  });

  it("metadata is independently copied per call (not a shared reference)", () => {
    const shared = { key: "value" };
    const a = createEmbeddingContext({
      embeddingId: "e-1",
      tenantId: "tenant-1",
      metadata: shared,
    });
    const b = createEmbeddingContext({
      embeddingId: "e-1",
      tenantId: "tenant-1",
      metadata: shared,
    });
    expect(a.metadata).not.toBe(b.metadata);
    expect(a.metadata).toEqual(b.metadata);
  });

  it("organizationId/departmentId are both optional and independently settable", () => {
    const context = createEmbeddingContext({
      embeddingId: "e-1",
      tenantId: "tenant-1",
      organizationId: "org-1",
    });
    expect(context.organizationId).toBe("org-1");
    expect(context.departmentId).toBeUndefined();
  });
});
