import { describe, expect, it } from "vitest";

import { KnowledgeSourceCatalog } from "../../src/catalog/knowledge-source-catalog.js";
import { KnowledgeSourceMetrics } from "../../src/metrics/knowledge-source-metrics.js";
import { KnowledgeSourceMonitor } from "../../src/monitoring/knowledge-source-monitor.js";
import { KnowledgeSourceRegistry } from "../../src/registry/knowledge-source-registry.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";

describe("KnowledgeSourceMonitor with a Source that has no workspaceId", () => {
  it("skips the undefined workspace key while still counting the provider/tenant", () => {
    const catalog = new KnowledgeSourceCatalog();
    catalog.register(metadataFixture({ sourceId: "s-1", workspaceId: undefined }));
    const monitor = new KnowledgeSourceMonitor(
      new KnowledgeSourceMetrics(),
      new KnowledgeSourceRegistry(),
      catalog,
    );
    const dashboard = monitor.sample();
    expect(dashboard.workspace.sources).toEqual({});
    expect(dashboard.tenant.sources["tenant-1"]).toBe(1);
  });
});
