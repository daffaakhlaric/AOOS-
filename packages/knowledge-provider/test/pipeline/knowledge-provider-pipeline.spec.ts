import { describe, expect, it } from "vitest";

import { KnowledgeProviderConfiguration } from "../../src/configuration/knowledge-provider-configuration.js";
import { ProviderConfigurationException } from "../../src/errors/provider-configuration-exception.js";
import { ProviderNotFoundException } from "../../src/errors/provider-not-found-exception.js";
import { ProviderPermissionDeniedException } from "../../src/errors/provider-permission-denied-exception.js";
import { ProviderPolicyViolationException } from "../../src/errors/provider-policy-violation-exception.js";
import { ProviderValidationException } from "../../src/errors/provider-validation-exception.js";
import { KnowledgeProviderEventType } from "../../src/events/knowledge-provider-event-type.js";
import { KnowledgeProviderEvents } from "../../src/events/knowledge-provider-events.js";
import { KnowledgeProviderMetrics } from "../../src/metrics/knowledge-provider-metrics.js";
import { KnowledgeProviderPipeline } from "../../src/pipeline/knowledge-provider-pipeline.js";
import { KnowledgeProviderPolicy } from "../../src/policy/knowledge-provider-policy.js";
import { KnowledgeProviderRegistryBucket } from "../../src/registry/knowledge-provider-registry-bucket.js";
import { KnowledgeProviderRegistry } from "../../src/registry/knowledge-provider-registry.js";
import { KnowledgeProviderResolver } from "../../src/resolver/knowledge-provider-resolver.js";
import { KnowledgeProviderValidator } from "../../src/validator/knowledge-provider-validator.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";
import { providerFixture } from "../helpers/provider-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

function buildPipeline(
  options: {
    registry?: KnowledgeProviderRegistry;
    permissionChecker?: { check: () => boolean | Promise<boolean> };
  } = {},
) {
  const registry = options.registry ?? new KnowledgeProviderRegistry();
  const resolver = new KnowledgeProviderResolver(registry);
  const policy = new KnowledgeProviderPolicy(registry);
  const { publisher, publish } = fakePublisher();
  const pipeline = new KnowledgeProviderPipeline(
    new KnowledgeProviderValidator(),
    policy,
    resolver,
    registry,
    new KnowledgeProviderMetrics(),
    new KnowledgeProviderEvents(publisher),
    { permissionChecker: options.permissionChecker as never },
  );
  return { pipeline, registry, policy, publish };
}

describe("KnowledgeProviderPipeline", () => {
  it("runs all 9 stages and resolves the registered Provider", async () => {
    const registry = new KnowledgeProviderRegistry();
    registry.register(KnowledgeProviderRegistryBucket.PROVIDER, providerFixture());
    const { pipeline } = buildPipeline({ registry });
    const output = await pipeline.run({ metadata: metadataFixture(), context: contextFixture() });
    expect(output.provider.id).toBe("provider-1");
    expect(output.capabilities.size).toBeGreaterThan(0);
  });

  it("throws ProviderValidationException for invalid metadata", async () => {
    const registry = new KnowledgeProviderRegistry();
    registry.register(KnowledgeProviderRegistryBucket.PROVIDER, providerFixture());
    const { pipeline } = buildPipeline({ registry });
    await expect(
      pipeline.run({
        metadata: metadataFixture({ providerId: "" }),
        context: contextFixture({ providerId: "" }),
      }),
    ).rejects.toThrow(ProviderValidationException);
  });

  it("publishes FAILED when any stage throws", async () => {
    const { pipeline, publish } = buildPipeline();
    await expect(
      pipeline.run({ metadata: metadataFixture(), context: contextFixture() }),
    ).rejects.toThrow(ProviderNotFoundException);
    const call = publish.mock.calls.find((c) => c[0].type === KnowledgeProviderEventType.FAILED);
    expect(call).toBeDefined();
  });

  it("rejects secret-looking configuration (caught by Validation's ConfigurationValidator stage)", async () => {
    const registry = new KnowledgeProviderRegistry();
    registry.register(KnowledgeProviderRegistryBucket.PROVIDER, providerFixture());
    const { pipeline } = buildPipeline({ registry });
    await expect(
      pipeline.run({
        metadata: metadataFixture({ providerConfiguration: { apiKey: "xyz" } }),
        context: contextFixture(),
      }),
    ).rejects.toThrow(ProviderValidationException);
  });

  it("Configuration stage itself throws ProviderConfigurationException when reached directly", () => {
    const configuration = new KnowledgeProviderConfiguration();
    expect(() => configuration.assertValid({ apiKey: "xyz" })).toThrow(
      ProviderConfigurationException,
    );
  });

  it("throws ProviderPolicyViolationException when a Policy denies the Provider's category", async () => {
    const registry = new KnowledgeProviderRegistry();
    registry.register(KnowledgeProviderRegistryBucket.PROVIDER, providerFixture());
    const { pipeline, policy } = buildPipeline({ registry });
    policy.register({
      id: "p-1",
      name: "No document",
      scope: { tenantId: "tenant-1" },
      enabled: true,
      deniedCategories: ["document" as never],
      createdAt: new Date().toISOString(),
    });
    await expect(
      pipeline.run({ metadata: metadataFixture(), context: contextFixture() }),
    ).rejects.toThrow(ProviderPolicyViolationException);
  });

  it("throws ProviderPermissionDeniedException when the permission checker rejects", async () => {
    const registry = new KnowledgeProviderRegistry();
    registry.register(KnowledgeProviderRegistryBucket.PROVIDER, providerFixture());
    const { pipeline } = buildPipeline({ registry, permissionChecker: { check: () => false } });
    await expect(
      pipeline.run({ metadata: metadataFixture(), context: contextFixture() }),
    ).rejects.toThrow(ProviderPermissionDeniedException);
  });

  it("throws ProviderNotFoundException when the Provider is not registered", async () => {
    const { pipeline } = buildPipeline();
    await expect(
      pipeline.run({ metadata: metadataFixture(), context: contextFixture() }),
    ).rejects.toThrow(ProviderNotFoundException);
  });

  it("publishes UPDATED after registering Metadata", async () => {
    const registry = new KnowledgeProviderRegistry();
    registry.register(KnowledgeProviderRegistryBucket.PROVIDER, providerFixture());
    const { pipeline, publish } = buildPipeline({ registry });
    await pipeline.run({ metadata: metadataFixture(), context: contextFixture() });
    const call = publish.mock.calls.find((c) => c[0].type === KnowledgeProviderEventType.UPDATED);
    expect(call).toBeDefined();
  });
});
