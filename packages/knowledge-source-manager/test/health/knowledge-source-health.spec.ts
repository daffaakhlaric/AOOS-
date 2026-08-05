import { describe, expect, it } from "vitest";

import { KnowledgeSourceCatalog } from "../../src/catalog/knowledge-source-catalog.js";
import { KnowledgeSourceHealth } from "../../src/health/knowledge-source-health.js";
import { KnowledgeSourceRegistryBucket } from "../../src/registry/knowledge-source-registry-bucket.js";
import { KnowledgeSourceRegistry } from "../../src/registry/knowledge-source-registry.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";

describe("KnowledgeSourceHealth", () => {
  it("reports unknown when nothing is registered", () => {
    const health = new KnowledgeSourceHealth(
      new KnowledgeSourceRegistry(),
      new KnowledgeSourceCatalog(),
    );
    const report = health.check();
    expect(report.status).toBe("unknown");
    expect(report.registry.status).toBe("unknown");
    expect(report.catalog.status).toBe("unknown");
  });

  it("reports healthy once the registry and catalog have entries", () => {
    const registry = new KnowledgeSourceRegistry();
    const catalog = new KnowledgeSourceCatalog();
    registry.register(KnowledgeSourceRegistryBucket.SOURCE, { id: "s-1" });
    catalog.register(metadataFixture());
    const report = new KnowledgeSourceHealth(registry, catalog).check();
    expect(report.status).toBe("healthy");
  });

  it("takes the worst of registry/catalog status", () => {
    const registry = new KnowledgeSourceRegistry();
    const catalog = new KnowledgeSourceCatalog();
    registry.register(KnowledgeSourceRegistryBucket.SOURCE, { id: "s-1" });
    // catalog stays empty -> unknown
    const report = new KnowledgeSourceHealth(registry, catalog).check();
    expect(report.status).toBe("unknown");
  });
});
