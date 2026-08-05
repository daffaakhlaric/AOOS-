import { describe, expect, it } from "vitest";

import { knowledgeQueryContextSchema } from "../../src/context/knowledge-query-context.js";

describe("knowledgeQueryContextSchema", () => {
  it("accepts the minimal required shape", () => {
    const context = knowledgeQueryContextSchema.parse({
      token: "rtok_1",
      correlationId: "corr-1",
      tenantId: "tenant-1",
      variables: {},
      metadata: {},
    });
    expect(context.tenantId).toBe("tenant-1");
  });

  it("rejects a blank token", () => {
    expect(() =>
      knowledgeQueryContextSchema.parse({
        token: "",
        correlationId: "corr-1",
        tenantId: "tenant-1",
        variables: {},
        metadata: {},
      }),
    ).toThrow();
  });

  it("rejects a blank tenantId", () => {
    expect(() =>
      knowledgeQueryContextSchema.parse({
        token: "rtok_1",
        correlationId: "corr-1",
        tenantId: "",
        variables: {},
        metadata: {},
      }),
    ).toThrow();
  });
});
