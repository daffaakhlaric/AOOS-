import { describe, expect, it } from "vitest";

import { knowledgeProviderContextSchema } from "../../src/context/knowledge-provider-context.js";
import { KnowledgeProviderCategory } from "../../src/domain/knowledge-provider-category.js";

describe("knowledgeProviderContextSchema", () => {
  const base = {
    token: "ptok_1",
    tenantId: "tenant-1",
    providerId: "provider-1",
    providerType: KnowledgeProviderCategory.DOCUMENT,
    metadata: {},
    correlationId: "corr-1",
  };

  it("accepts the minimal required shape", () => {
    expect(knowledgeProviderContextSchema.parse(base)).toMatchObject(base);
  });

  it("rejects a blank token", () => {
    expect(() => knowledgeProviderContextSchema.parse({ ...base, token: "" })).toThrow();
  });

  it("rejects a blank tenantId", () => {
    expect(() => knowledgeProviderContextSchema.parse({ ...base, tenantId: "" })).toThrow();
  });

  it("rejects an unknown providerType", () => {
    expect(() =>
      knowledgeProviderContextSchema.parse({ ...base, providerType: "bogus" }),
    ).toThrow();
  });
});
