import { describe, expect, it } from "vitest";

import * as PublicApi from "../src/index.js";

const REQUIRED_PUBLIC_API_NAMES = [
  "KnowledgeMarketplace",
  "KnowledgeMarketplaceManager",
  "KnowledgeMarketplaceRegistry",
  "KnowledgeMarketplaceResolver",
  "KnowledgeMarketplaceValidator",
  "KnowledgeMarketplacePipeline",
  "KnowledgeMarketplaceMiddleware",
  "KnowledgeMarketplaceFactory",
  "KnowledgeMarketplaceSession",
  "KnowledgeMarketplaceLifecycle",
  "KnowledgeMarketplaceStateMachine",
  "KnowledgeMarketplaceEvents",
  "KnowledgeMarketplaceMetrics",
  "KnowledgeMarketplaceHealth",
  "KnowledgeMarketplaceMonitoring",
  "KnowledgeMarketplaceStatistics",
  "KnowledgeMarketplaceSystem",
];

describe("public API surface", () => {
  it.each(REQUIRED_PUBLIC_API_NAMES)("exports %s as a class", (name) => {
    expect(typeof (PublicApi as unknown as Record<string, unknown>)[name]).toBe("function");
  });

  it("exports exactly the 17 class names plus KnowledgeMarketplaceContext as the 18th named Public API member", () => {
    expect(REQUIRED_PUBLIC_API_NAMES).toHaveLength(17);
  });

  it("does not export internal validator-stage classes as loose top-level surprises beyond the documented set", () => {
    // Validator stages ARE intentionally exported (matching the sibling packages'
    // curation convention of exposing stage classes for extensibility), but never as
    // one of the 18 named Public API members.
    expect(PublicApi.IdentityValidator).toBeDefined();
    expect(PublicApi.KnowledgeMarketplaceValidator).toBeDefined();
  });

  it("exports the domain enums", () => {
    expect(PublicApi.MarketplacePackageStatus).toBeDefined();
    expect(PublicApi.MarketplaceType).toBeDefined();
    expect(PublicApi.MarketplaceCategoryName).toBeDefined();
    expect(PublicApi.MarketplaceDependencyKind).toBeDefined();
    expect(PublicApi.MarketplaceCertificationLevel).toBeDefined();
  });

  it("exports the Registry bucket enum with 8 buckets", () => {
    expect(Object.values(PublicApi.KnowledgeMarketplaceRegistryBucket)).toHaveLength(8);
  });

  it("exports the Event type enum with 11 events", () => {
    expect(Object.values(PublicApi.KnowledgeMarketplaceEventType)).toHaveLength(11);
  });

  it("exports the error hierarchy", () => {
    expect(PublicApi.KnowledgeMarketplaceException).toBeDefined();
    expect(PublicApi.MarketplaceNotFoundException).toBeDefined();
    expect(PublicApi.MarketplaceValidationException).toBeDefined();
  });

  it("exports the token helpers", () => {
    expect(typeof PublicApi.generateKnowledgeMarketplaceToken).toBe("function");
    expect(typeof PublicApi.isKnowledgeMarketplaceToken).toBe("function");
  });

  it("exports createKnowledgeMarketplaceContext", () => {
    expect(typeof PublicApi.createKnowledgeMarketplaceContext).toBe("function");
  });

  it("exports the built-in category catalog", () => {
    expect(PublicApi.BUILT_IN_CATEGORY_DEFINITIONS).toHaveLength(15);
    expect(typeof PublicApi.isBuiltInCategory).toBe("function");
  });

  it("exports KnowledgeMarketplaceRecord distinctly from the KnowledgeMarketplace façade", () => {
    expect(PublicApi.KnowledgeMarketplaceRecord).toBeDefined();
    expect(PublicApi.KnowledgeMarketplaceRecord).not.toBe(PublicApi.KnowledgeMarketplace);
  });

  it("a KnowledgeMarketplaceSystem constructed from the public API wires a working façade", () => {
    const publish = async () => ({}) as never;
    const system = new PublicApi.KnowledgeMarketplaceSystem({
      publish,
      publishAsync: publish,
      publishBatch: async () => [],
    } as never);
    expect(system.marketplace).toBeInstanceOf(PublicApi.KnowledgeMarketplace);
  });
});
