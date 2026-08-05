import { describe, expect, it } from "vitest";

import { createKnowledgeSourceContext } from "../../src/context/create-knowledge-source-context.js";
import { knowledgeSourceContextSchema } from "../../src/context/knowledge-source-context.js";

describe("KnowledgeSourceContext", () => {
  it("has exactly the 14 fields named in the prompt", () => {
    const shape = knowledgeSourceContextSchema.shape;
    expect(Object.keys(shape)).toHaveLength(14);
  });

  it("createKnowledgeSourceContext generates a token when none is supplied", () => {
    const context = createKnowledgeSourceContext({
      sourceId: "source-1",
      providerId: "provider-1",
      tenantId: "tenant-1",
    });
    expect(context.token).toMatch(/^ksrc_/);
  });

  it("createKnowledgeSourceContext generates a correlationId when none is supplied", () => {
    const context = createKnowledgeSourceContext({
      sourceId: "source-1",
      providerId: "provider-1",
      tenantId: "tenant-1",
    });
    expect(context.correlationId).toBeTruthy();
  });

  it("createKnowledgeSourceContext preserves a supplied token/correlationId", () => {
    const context = createKnowledgeSourceContext({
      token: "ksrc_custom",
      correlationId: "corr-custom",
      sourceId: "source-1",
      providerId: "provider-1",
      tenantId: "tenant-1",
    });
    expect(context.token).toBe("ksrc_custom");
    expect(context.correlationId).toBe("corr-custom");
  });

  it("passes schema validation", () => {
    const context = createKnowledgeSourceContext({
      sourceId: "source-1",
      providerId: "provider-1",
      tenantId: "tenant-1",
    });
    expect(() => knowledgeSourceContextSchema.parse(context)).not.toThrow();
  });

  it("defaults metadata to an empty object", () => {
    const context = createKnowledgeSourceContext({
      sourceId: "source-1",
      providerId: "provider-1",
      tenantId: "tenant-1",
    });
    expect(context.metadata).toEqual({});
  });
});
