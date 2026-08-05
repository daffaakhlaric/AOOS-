import { describe, expect, it } from "vitest";

import { KnowledgeSourceCatalog } from "../../src/catalog/knowledge-source-catalog.js";
import { KnowledgeSourceHealth } from "../../src/health/knowledge-source-health.js";
import { KnowledgeSourceRegistryBucket } from "../../src/registry/knowledge-source-registry-bucket.js";
import { KnowledgeSourceRegistry } from "../../src/registry/knowledge-source-registry.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";

describe("KnowledgeSourceHealth additional coverage", () => {
  it("catalog health details include the current count once populated", () => {
    const registry = new KnowledgeSourceRegistry();
    const catalog = new KnowledgeSourceCatalog();
    registry.register(KnowledgeSourceRegistryBucket.SOURCE, { id: "s-1" });
    catalog.register(metadataFixture({ sourceId: "s-1" }));
    catalog.register(metadataFixture({ sourceId: "s-2" }));
    const report = new KnowledgeSourceHealth(registry, catalog).check();
    expect(report.catalog.details).toEqual({ count: 2 });
  });

  it("registry health aggregates across every bucket, not just SOURCE", () => {
    const registry = new KnowledgeSourceRegistry();
    const catalog = new KnowledgeSourceCatalog();
    registry.register(KnowledgeSourceRegistryBucket.POLICY, { id: "policy-1" });
    catalog.register(metadataFixture());
    const report = new KnowledgeSourceHealth(registry, catalog).check();
    expect(report.registry.status).toBe("healthy");
  });
});
