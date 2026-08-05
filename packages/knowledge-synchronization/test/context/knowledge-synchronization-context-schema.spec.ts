import { describe, expect, it } from "vitest";

import { knowledgeSynchronizationContextSchema } from "../../src/context/knowledge-synchronization-context.js";
import { KnowledgeSynchronizationProviderType } from "../../src/domain/knowledge-synchronization-provider-type.js";

describe("knowledgeSynchronizationContextSchema", () => {
  const base = {
    synchronizationId: "sync-1",
    token: "stok_1",
    tenantId: "tenant-1",
    providerId: "provider-1",
    sourceId: "source-1",
    sourceType: KnowledgeSynchronizationProviderType.DOCUMENT,
    metadata: {},
    correlationId: "corr-1",
  };

  it("accepts the minimal required shape", () => {
    expect(knowledgeSynchronizationContextSchema.parse(base)).toMatchObject(base);
  });

  it("rejects a blank token", () => {
    expect(() => knowledgeSynchronizationContextSchema.parse({ ...base, token: "" })).toThrow();
  });

  it("rejects a blank tenantId", () => {
    expect(() => knowledgeSynchronizationContextSchema.parse({ ...base, tenantId: "" })).toThrow();
  });

  it("rejects an unknown sourceType", () => {
    expect(() =>
      knowledgeSynchronizationContextSchema.parse({ ...base, sourceType: "bogus" }),
    ).toThrow();
  });
});
