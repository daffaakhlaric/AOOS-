import { describe, expect, it } from "vitest";

import { KnowledgeMarketplaceHealth } from "../../src/health/knowledge-marketplace-health.js";
import { KnowledgeMarketplaceRegistryBucket } from "../../src/registry/knowledge-marketplace-registry-bucket.js";
import { KnowledgeMarketplaceRegistry } from "../../src/registry/knowledge-marketplace-registry.js";

describe("KnowledgeMarketplaceHealth", () => {
  it("reports unknown registry health when nothing is registered", () => {
    const health = new KnowledgeMarketplaceHealth(new KnowledgeMarketplaceRegistry());
    expect(health.check().registry.status).toBe("unknown");
  });

  it("reports healthy registry health once something is registered", () => {
    const registry = new KnowledgeMarketplaceRegistry();
    registry.register(KnowledgeMarketplaceRegistryBucket.PACKAGE, { id: "p-1" });
    const health = new KnowledgeMarketplaceHealth(registry);
    expect(health.check().registry.status).toBe("healthy");
  });

  it("reports unknown domain health with no recorded operations", () => {
    const health = new KnowledgeMarketplaceHealth(new KnowledgeMarketplaceRegistry());
    expect(health.check(0, 0).domain.status).toBe("unknown");
  });

  it("reports healthy domain health with zero failures", () => {
    const health = new KnowledgeMarketplaceHealth(new KnowledgeMarketplaceRegistry());
    expect(health.check(10, 0).domain.status).toBe("healthy");
  });

  it("reports warning domain health under 10% failure ratio", () => {
    const health = new KnowledgeMarketplaceHealth(new KnowledgeMarketplaceRegistry());
    expect(health.check(95, 5).domain.status).toBe("warning");
  });

  it("reports degraded domain health under 50% failure ratio", () => {
    const health = new KnowledgeMarketplaceHealth(new KnowledgeMarketplaceRegistry());
    expect(health.check(70, 30).domain.status).toBe("degraded");
  });

  it("reports unavailable domain health at or above 50% failure ratio", () => {
    const health = new KnowledgeMarketplaceHealth(new KnowledgeMarketplaceRegistry());
    expect(health.check(10, 90).domain.status).toBe("unavailable");
  });

  it("overall status is the worst of registry/domain", () => {
    const registry = new KnowledgeMarketplaceRegistry();
    registry.register(KnowledgeMarketplaceRegistryBucket.PACKAGE, { id: "p-1" });
    const health = new KnowledgeMarketplaceHealth(registry);
    expect(health.check(10, 90).status).toBe("unavailable");
  });

  it("defaults successCount/failureCount to 0 when omitted", () => {
    const health = new KnowledgeMarketplaceHealth(new KnowledgeMarketplaceRegistry());
    expect(health.check().domain.status).toBe("unknown");
  });
});
