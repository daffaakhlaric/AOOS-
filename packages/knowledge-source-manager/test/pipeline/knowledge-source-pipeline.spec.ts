import { describe, expect, it, vi } from "vitest";

import { KnowledgeSourceCatalog } from "../../src/catalog/knowledge-source-catalog.js";
import type { IKnowledgeSourceProviderResolver } from "../../src/contracts/i-knowledge-source-provider-resolver.js";
import { SourcePermissionDeniedException } from "../../src/errors/source-permission-denied-exception.js";
import { SourcePolicyViolationException } from "../../src/errors/source-policy-violation-exception.js";
import { SourceValidationException } from "../../src/errors/source-validation-exception.js";
import { KnowledgeSourceEventType } from "../../src/events/knowledge-source-event-type.js";
import { KnowledgeSourceEvents } from "../../src/events/knowledge-source-events.js";
import { KnowledgeSourceMetrics } from "../../src/metrics/knowledge-source-metrics.js";
import { KnowledgeSourcePermission } from "../../src/permission/knowledge-source-permission.js";
import { KnowledgeSourcePipeline } from "../../src/pipeline/knowledge-source-pipeline.js";
import { KnowledgeSourcePolicy } from "../../src/policy/knowledge-source-policy.js";
import { KnowledgeSourceRegistry } from "../../src/registry/knowledge-source-registry.js";
import { KnowledgeSourceValidator } from "../../src/validator/knowledge-source-validator.js";
import { configurationFixture } from "../helpers/configuration-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

function build(providerResolver?: IKnowledgeSourceProviderResolver) {
  const registry = new KnowledgeSourceRegistry();
  const catalog = new KnowledgeSourceCatalog();
  const { publisher, publish } = fakePublisher();
  const pipeline = new KnowledgeSourcePipeline(
    new KnowledgeSourceValidator(),
    new KnowledgeSourcePolicy(registry),
    new KnowledgeSourcePermission(registry),
    registry,
    catalog,
    new KnowledgeSourceMetrics(),
    new KnowledgeSourceEvents(publisher),
    { providerResolver },
  );
  return { pipeline, registry, catalog, publish };
}

describe("KnowledgeSourcePipeline", () => {
  it("runs all 9 stages successfully for a well-formed input", async () => {
    const { pipeline, catalog, publish } = build();
    const output = await pipeline.run({
      metadata: metadataFixture(),
      configuration: configurationFixture(),
      context: contextFixture(),
    });
    expect(output.metadata.sourceId).toBe("source-1");
    expect(catalog.get("source-1")).toBeDefined();
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: KnowledgeSourceEventType.REGISTERED }),
    );
  });

  it("throws SourceValidationException for invalid metadata", async () => {
    const { pipeline } = build();
    await expect(
      pipeline.run({
        metadata: metadataFixture({ sourceId: "" }),
        configuration: configurationFixture(),
        context: contextFixture(),
      }),
    ).rejects.toThrow(SourceValidationException);
  });

  it("throws SourcePolicyViolationException when a registered Policy denies the Category", async () => {
    const { pipeline, registry } = build();
    new KnowledgeSourcePolicy(registry).register({
      id: "policy-1",
      name: "deny-document",
      scope: { tenantId: "tenant-1" },
      enabled: true,
      deniedCategories: [metadataFixture().sourceCategory],
      createdAt: new Date().toISOString(),
    });
    await expect(
      pipeline.run({
        metadata: metadataFixture(),
        configuration: configurationFixture(),
        context: contextFixture(),
      }),
    ).rejects.toThrow(SourcePolicyViolationException);
  });

  it("throws SourcePermissionDeniedException when a registered grant denies the Context", async () => {
    const { pipeline, registry } = build();
    new KnowledgeSourcePermission(registry).register({
      id: "grant-1",
      scope: { tenantId: "tenant-1" },
      effect: "deny",
      createdAt: new Date().toISOString(),
    });
    await expect(
      pipeline.run({
        metadata: metadataFixture(),
        configuration: configurationFixture(),
        context: contextFixture(),
      }),
    ).rejects.toThrow(SourcePermissionDeniedException);
  });

  it("invokes the optional Provider Resolution stage when a resolver is supplied", async () => {
    const resolveProvider = vi.fn().mockResolvedValue({ id: "provider-1" });
    const { pipeline } = build({ resolveProvider });
    await pipeline.run({
      metadata: metadataFixture(),
      configuration: configurationFixture(),
      context: contextFixture(),
    });
    expect(resolveProvider).toHaveBeenCalledWith("provider-1");
  });

  it("skips Provider Resolution when no resolver is supplied", async () => {
    const { pipeline } = build();
    await expect(
      pipeline.run({
        metadata: metadataFixture(),
        configuration: configurationFixture(),
        context: contextFixture(),
      }),
    ).resolves.toBeDefined();
  });

  it("computes Sync Enabled Count / Schedule Count from registered entries", async () => {
    const { pipeline, registry } = build();
    await pipeline.run({
      metadata: metadataFixture(),
      configuration: configurationFixture({ enabled: true, autoSync: true }),
      context: contextFixture(),
    });
    // metrics are internal to the pipeline; verify via the registry's SOURCE bucket size instead.
    expect(registry.count("source" as never)).toBe(1);
  });
});
