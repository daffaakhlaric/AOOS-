import { describe, expect, it } from "vitest";

import { createEmbeddingContext } from "../../src/context/create-embedding-context.js";
import { embeddingContextSchema } from "../../src/context/embedding-context.js";
import { isEmbeddingManagerToken } from "../../src/token/embedding-manager-token.js";

describe("createEmbeddingContext", () => {
  it("assigns a fresh token when none is supplied", () => {
    const context = createEmbeddingContext({ embeddingId: "e-1", tenantId: "tenant-1" });
    expect(isEmbeddingManagerToken(context.token)).toBe(true);
  });

  it("uses the supplied token when provided", () => {
    const context = createEmbeddingContext({
      embeddingId: "e-1",
      tenantId: "tenant-1",
      token: "embt_fixed",
    });
    expect(context.token).toBe("embt_fixed");
  });

  it("assigns a fresh correlationId when none is supplied", () => {
    const context = createEmbeddingContext({ embeddingId: "e-1", tenantId: "tenant-1" });
    expect(context.correlationId.length).toBeGreaterThan(0);
  });

  it("uses the supplied correlationId when provided", () => {
    const context = createEmbeddingContext({
      embeddingId: "e-1",
      tenantId: "tenant-1",
      correlationId: "corr-fixed",
    });
    expect(context.correlationId).toBe("corr-fixed");
  });

  it("copies optional fields through", () => {
    const context = createEmbeddingContext({
      embeddingId: "e-1",
      tenantId: "tenant-1",
      organizationId: "org-1",
      workspaceId: "ws-1",
      departmentId: "dept-1",
      environment: "production",
      namespace: "docs",
      traceId: "trace-1",
      metadata: { a: 1 },
    });
    expect(context.organizationId).toBe("org-1");
    expect(context.workspaceId).toBe("ws-1");
    expect(context.departmentId).toBe("dept-1");
    expect(context.environment).toBe("production");
    expect(context.namespace).toBe("docs");
    expect(context.traceId).toBe("trace-1");
    expect(context.metadata).toEqual({ a: 1 });
  });

  it("defaults metadata to an empty object", () => {
    const context = createEmbeddingContext({ embeddingId: "e-1", tenantId: "tenant-1" });
    expect(context.metadata).toEqual({});
  });

  it("produces a context that satisfies embeddingContextSchema", () => {
    const context = createEmbeddingContext({ embeddingId: "e-1", tenantId: "tenant-1" });
    expect(embeddingContextSchema.safeParse(context).success).toBe(true);
  });
});
