import { describe, expect, it } from "vitest";

import { knowledgeSourceMetadataRecordSchema } from "../../src/domain/knowledge-source-metadata-record.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";

describe("knowledgeSourceMetadataRecordSchema", () => {
  it("accepts a well-formed metadata record", () => {
    expect(() => knowledgeSourceMetadataRecordSchema.parse(metadataFixture())).not.toThrow();
  });

  it("has exactly the 24 fields named in the prompt", () => {
    const shape = knowledgeSourceMetadataRecordSchema.shape;
    expect(Object.keys(shape).sort()).toEqual(
      [
        "sourceId",
        "sourceName",
        "sourceDescription",
        "sourceCategory",
        "sourceProvider",
        "providerId",
        "providerVersion",
        "namespace",
        "collection",
        "workspaceId",
        "tenantId",
        "organizationId",
        "departmentId",
        "labels",
        "tags",
        "priority",
        "policy",
        "permission",
        "environment",
        "owner",
        "createdBy",
        "updatedBy",
        "createdAt",
        "updatedAt",
      ].sort(),
    );
    expect(Object.keys(shape)).toHaveLength(24);
  });

  it("rejects a blank sourceId", () => {
    expect(() =>
      knowledgeSourceMetadataRecordSchema.parse(metadataFixture({ sourceId: "" })),
    ).toThrow();
  });

  it("rejects a negative priority", () => {
    expect(() =>
      knowledgeSourceMetadataRecordSchema.parse(metadataFixture({ priority: -1 })),
    ).toThrow();
  });
});
