import { describe, expect, it } from "vitest";

import { KnowledgeSourceCatalog } from "../../src/catalog/knowledge-source-catalog.js";
import { KnowledgeSourceEvents } from "../../src/events/knowledge-source-events.js";
import { KnowledgeSourceMetrics } from "../../src/metrics/knowledge-source-metrics.js";
import { KnowledgeSourcePermission } from "../../src/permission/knowledge-source-permission.js";
import { KnowledgeSourcePipeline } from "../../src/pipeline/knowledge-source-pipeline.js";
import { KnowledgeSourcePolicy } from "../../src/policy/knowledge-source-policy.js";
import { KnowledgeSourceRegistry } from "../../src/registry/knowledge-source-registry.js";
import { KnowledgeSourceScheduleMode } from "../../src/scheduler/knowledge-source-schedule-mode.js";
import { KnowledgeSourceValidator } from "../../src/validator/knowledge-source-validator.js";
import { configurationFixture } from "../helpers/configuration-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

describe("KnowledgeSourcePipeline metrics stage", () => {
  it("increments Sync Enabled Count / Schedule Count / Policy Count / Permission Count as entries are registered", async () => {
    const registry = new KnowledgeSourceRegistry();
    const catalog = new KnowledgeSourceCatalog();
    const metrics = new KnowledgeSourceMetrics();
    const { publisher } = fakePublisher();
    const policy = new KnowledgeSourcePolicy(registry);
    const permission = new KnowledgeSourcePermission(registry);
    policy.register({
      id: "policy-1",
      name: "p",
      scope: { tenantId: "tenant-1" },
      enabled: true,
      createdAt: new Date().toISOString(),
    });
    permission.register({
      id: "grant-1",
      scope: { tenantId: "tenant-1" },
      effect: "allow",
      createdAt: new Date().toISOString(),
    });
    const pipeline = new KnowledgeSourcePipeline(
      new KnowledgeSourceValidator(),
      policy,
      permission,
      registry,
      catalog,
      metrics,
      new KnowledgeSourceEvents(publisher),
    );

    await pipeline.run({
      metadata: metadataFixture(),
      configuration: configurationFixture({
        enabled: true,
        autoSync: true,
        syncMode: KnowledgeSourceScheduleMode.CRON,
        schedule: { mode: KnowledgeSourceScheduleMode.CRON, cronExpression: "* * * * *" },
      }),
      context: contextFixture(),
    });

    const snapshot = metrics.snapshot();
    expect(snapshot.sourceCount).toBe(1);
    expect(snapshot.syncEnabledCount).toBe(1);
    expect(snapshot.scheduleCount).toBe(1);
    expect(snapshot.policyCount).toBe(1);
    expect(snapshot.permissionCount).toBe(1);
  });

  it("does not count a Source with no schedule toward Schedule Count", async () => {
    const registry = new KnowledgeSourceRegistry();
    const catalog = new KnowledgeSourceCatalog();
    const metrics = new KnowledgeSourceMetrics();
    const { publisher } = fakePublisher();
    const pipeline = new KnowledgeSourcePipeline(
      new KnowledgeSourceValidator(),
      new KnowledgeSourcePolicy(registry),
      new KnowledgeSourcePermission(registry),
      registry,
      catalog,
      metrics,
      new KnowledgeSourceEvents(publisher),
    );
    await pipeline.run({
      metadata: metadataFixture(),
      configuration: configurationFixture(),
      context: contextFixture(),
    });
    expect(metrics.snapshot().scheduleCount).toBe(0);
    expect(metrics.snapshot().syncEnabledCount).toBe(0);
  });
});
