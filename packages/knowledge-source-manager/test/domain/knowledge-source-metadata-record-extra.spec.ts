import { describe, expect, it } from "vitest";

import { knowledgeSourceMetadataRecordSchema } from "../../src/domain/knowledge-source-metadata-record.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";

describe("knowledgeSourceMetadataRecordSchema additional coverage", () => {
  it("accepts every optional field populated", () => {
    const full = metadataFixture({
      sourceDescription: "desc",
      providerVersion: "1.2.3",
      namespace: "ns-1",
      collection: "col-1",
      organizationId: "org-1",
      departmentId: "dept-1",
      policy: "policy-1",
      permission: "perm-1",
      environment: "production",
      owner: "alice",
      createdBy: "alice",
      updatedBy: "bob",
      labels: ["l1"],
      tags: ["t1"],
    });
    expect(() => knowledgeSourceMetadataRecordSchema.parse(full)).not.toThrow();
  });

  it("rejects a blank tenantId", () => {
    expect(() =>
      knowledgeSourceMetadataRecordSchema.parse(metadataFixture({ tenantId: "" })),
    ).toThrow();
  });

  it("rejects a blank sourceProvider", () => {
    expect(() =>
      knowledgeSourceMetadataRecordSchema.parse(metadataFixture({ sourceProvider: "" })),
    ).toThrow();
  });

  it("rejects a blank providerId", () => {
    expect(() =>
      knowledgeSourceMetadataRecordSchema.parse(metadataFixture({ providerId: "" })),
    ).toThrow();
  });

  it("rejects a malformed createdAt", () => {
    expect(() =>
      knowledgeSourceMetadataRecordSchema.parse(metadataFixture({ createdAt: "not-a-date" })),
    ).toThrow();
  });
});
