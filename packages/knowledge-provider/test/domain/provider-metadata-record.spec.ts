import { describe, expect, it } from "vitest";

import { KnowledgeProviderCategory } from "../../src/domain/knowledge-provider-category.js";
import { KnowledgeProviderStatus } from "../../src/domain/knowledge-provider-status.js";
import { providerMetadataRecordSchema } from "../../src/domain/provider-metadata-record.js";

describe("providerMetadataRecordSchema", () => {
  const base = {
    providerId: "provider-1",
    providerName: "Test Provider",
    providerVersion: "1.0.0",
    providerCategory: KnowledgeProviderCategory.DOCUMENT,
    providerCapabilities: [],
    providerConfiguration: {},
    providerStatus: KnowledgeProviderStatus.ACTIVE,
    providerPriority: 0,
    providerTags: [],
    providerLabels: [],
    providerDependencies: [],
  };

  it("accepts the minimal required shape", () => {
    expect(providerMetadataRecordSchema.parse(base)).toMatchObject(base);
  });

  it("accepts all 18 fields populated", () => {
    const full = {
      ...base,
      providerAuthor: "Acme",
      providerDescription: "A test provider",
      providerPolicy: "policy-1",
      providerNamespace: "ns-1",
      providerIcon: "icon.svg",
      providerLicense: "MIT",
      providerHomepage: "https://example.com",
    };
    expect(providerMetadataRecordSchema.parse(full)).toMatchObject(full);
  });

  it("rejects a blank providerId", () => {
    expect(() => providerMetadataRecordSchema.parse({ ...base, providerId: "" })).toThrow();
  });

  it("rejects a negative providerPriority", () => {
    expect(() => providerMetadataRecordSchema.parse({ ...base, providerPriority: -1 })).toThrow();
  });

  it("rejects an unknown providerCategory", () => {
    expect(() =>
      providerMetadataRecordSchema.parse({ ...base, providerCategory: "bogus" }),
    ).toThrow();
  });
});
