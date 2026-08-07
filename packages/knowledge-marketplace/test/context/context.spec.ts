import { describe, expect, it } from "vitest";

import { createKnowledgeMarketplaceContext } from "../../src/context/create-knowledge-marketplace-context.js";
import { knowledgeMarketplaceContextSchema } from "../../src/context/knowledge-marketplace-context.js";
import { isKnowledgeMarketplaceToken } from "../../src/token/knowledge-marketplace-token.js";

describe("createKnowledgeMarketplaceContext", () => {
  it("generates a well-formed token when none is supplied", () => {
    const context = createKnowledgeMarketplaceContext({
      listingId: "listing-1",
      tenantId: "tenant-1",
    });
    expect(isKnowledgeMarketplaceToken(context.token)).toBe(true);
  });

  it("uses the supplied token when present", () => {
    const context = createKnowledgeMarketplaceContext({
      token: "kmkt_explicit",
      listingId: "listing-1",
      tenantId: "tenant-1",
    });
    expect(context.token).toBe("kmkt_explicit");
  });

  it("generates a correlationId when none is supplied", () => {
    const context = createKnowledgeMarketplaceContext({
      listingId: "listing-1",
      tenantId: "tenant-1",
    });
    expect(context.correlationId.length).toBeGreaterThan(0);
  });

  it("uses the supplied correlationId when present", () => {
    const context = createKnowledgeMarketplaceContext({
      listingId: "listing-1",
      tenantId: "tenant-1",
      correlationId: "corr-explicit",
    });
    expect(context.correlationId).toBe("corr-explicit");
  });

  it("defaults metadata to an empty object", () => {
    const context = createKnowledgeMarketplaceContext({
      listingId: "listing-1",
      tenantId: "tenant-1",
    });
    expect(context.metadata).toEqual({});
  });

  it("carries through optional scoping fields", () => {
    const context = createKnowledgeMarketplaceContext({
      listingId: "listing-1",
      tenantId: "tenant-1",
      organizationId: "org-1",
      workspaceId: "workspace-1",
      departmentId: "dept-1",
      environment: "production",
      namespace: "ns-1",
      traceId: "trace-1",
      metadata: { platform: "web" },
    });
    expect(context.organizationId).toBe("org-1");
    expect(context.workspaceId).toBe("workspace-1");
    expect(context.departmentId).toBe("dept-1");
    expect(context.environment).toBe("production");
    expect(context.namespace).toBe("ns-1");
    expect(context.traceId).toBe("trace-1");
    expect(context.metadata.platform).toBe("web");
  });

  it("produces a schema-valid context", () => {
    const context = createKnowledgeMarketplaceContext({
      listingId: "listing-1",
      tenantId: "tenant-1",
    });
    expect(() => knowledgeMarketplaceContextSchema.parse(context)).not.toThrow();
  });

  it("rejects a context missing tenantId", () => {
    expect(() =>
      knowledgeMarketplaceContextSchema.parse({
        token: "kmkt_1",
        listingId: "listing-1",
        tenantId: "",
        metadata: {},
        correlationId: "corr-1",
      }),
    ).toThrow();
  });
});
