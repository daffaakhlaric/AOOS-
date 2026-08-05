import { describe, expect, it } from "vitest";

import { KnowledgeProviderCapabilityFlag } from "../../src/domain/knowledge-provider-capability-flag.js";
import { KnowledgeProviderCategory } from "../../src/domain/knowledge-provider-category.js";
import { KnowledgeProviderFactory } from "../../src/factory/knowledge-provider-factory.js";

describe("KnowledgeProviderFactory", () => {
  it("composes all 5 sub-factories", () => {
    const factory = new KnowledgeProviderFactory();
    expect(factory.context).toBeDefined();
    expect(factory.session).toBeDefined();
    expect(factory.metadata).toBeDefined();
    expect(factory.capability).toBeDefined();
    expect(factory.statistics).toBeDefined();
  });
});

describe("ProviderContextFactory", () => {
  it("wraps createKnowledgeProviderContext()", () => {
    const factory = new KnowledgeProviderFactory();
    const context = factory.context.create({
      tenantId: "tenant-1",
      providerId: "provider-1",
      providerType: KnowledgeProviderCategory.DOCUMENT,
    });
    expect(context.tenantId).toBe("tenant-1");
    expect(context.token.length).toBeGreaterThan(0);
  });
});

describe("ProviderSessionFactory", () => {
  it("produces an unregistered OPEN session record", () => {
    const factory = new KnowledgeProviderFactory();
    const record = factory.session.create("ptok_1", "holder-1");
    expect(record.state).toBe("open");
    expect(record.token).toBe("ptok_1");
  });
});

describe("ProviderMetadataFactory", () => {
  it("defaults optional list/record fields to empty and status to ACTIVE", () => {
    const factory = new KnowledgeProviderFactory();
    const metadata = factory.metadata.create({
      providerId: "provider-1",
      providerName: "Test Provider",
      providerVersion: "1.0.0",
      providerCategory: KnowledgeProviderCategory.DOCUMENT,
    });
    expect(metadata.providerCapabilities).toEqual([]);
    expect(metadata.providerTags).toEqual([]);
    expect(metadata.providerConfiguration).toEqual({});
    expect(metadata.providerStatus).toBe("active");
    expect(metadata.providerPriority).toBe(0);
  });

  it("preserves supplied optional fields", () => {
    const factory = new KnowledgeProviderFactory();
    const metadata = factory.metadata.create({
      providerId: "provider-1",
      providerName: "Test Provider",
      providerVersion: "1.0.0",
      providerCategory: KnowledgeProviderCategory.DOCUMENT,
      providerCapabilities: [KnowledgeProviderCapabilityFlag.SUPPORTS_READ],
      providerTags: ["alpha"],
      providerPriority: 5,
    });
    expect(metadata.providerCapabilities).toEqual([KnowledgeProviderCapabilityFlag.SUPPORTS_READ]);
    expect(metadata.providerTags).toEqual(["alpha"]);
    expect(metadata.providerPriority).toBe(5);
  });
});

describe("ProviderCapabilityFactory", () => {
  it("builds a KnowledgeProviderCapabilities wrapper", () => {
    const factory = new KnowledgeProviderFactory();
    const capabilities = factory.capability.create([KnowledgeProviderCapabilityFlag.SUPPORTS_READ]);
    expect(capabilities.has(KnowledgeProviderCapabilityFlag.SUPPORTS_READ)).toBe(true);
  });
});

describe("ProviderStatisticsFactory", () => {
  it("returns an empty statistics snapshot", () => {
    const factory = new KnowledgeProviderFactory();
    expect(factory.statistics.create()).toEqual({ registrationCount: 0, usageCount: 0 });
  });
});
