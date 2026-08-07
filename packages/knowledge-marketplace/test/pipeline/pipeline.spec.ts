import { beforeEach, describe, expect, it } from "vitest";

import { MarketplacePackageStatus } from "../../src/domain/marketplace-package-status.js";
import { MarketplaceCompatibilityException } from "../../src/errors/marketplace-compatibility-exception.js";
import { MarketplaceDependencyException } from "../../src/errors/marketplace-dependency-exception.js";
import { MarketplaceValidationException } from "../../src/errors/marketplace-validation-exception.js";
import { KnowledgeMarketplaceMetrics } from "../../src/metrics/knowledge-marketplace-metrics.js";
import { KnowledgeMarketplacePipeline } from "../../src/pipeline/knowledge-marketplace-pipeline.js";
import { KnowledgeMarketplaceRegistryBucket } from "../../src/registry/knowledge-marketplace-registry-bucket.js";
import { KnowledgeMarketplaceRegistry } from "../../src/registry/knowledge-marketplace-registry.js";
import { KnowledgeMarketplaceResolver } from "../../src/resolver/knowledge-marketplace-resolver.js";
import { KnowledgeMarketplaceValidator } from "../../src/validator/knowledge-marketplace-validator.js";
import { compatibilityFixture } from "../helpers/compatibility-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { dependencyFixture } from "../helpers/dependency-fixture.js";
import { executionFixture } from "../helpers/execution-fixture.js";
import { packageFixture } from "../helpers/package-fixture.js";
import { publisherFixture } from "../helpers/publisher-fixture.js";

describe("KnowledgeMarketplacePipeline", () => {
  let registry: KnowledgeMarketplaceRegistry;
  let resolver: KnowledgeMarketplaceResolver;
  let metrics: KnowledgeMarketplaceMetrics;
  let pipeline: KnowledgeMarketplacePipeline;

  beforeEach(() => {
    registry = new KnowledgeMarketplaceRegistry();
    resolver = new KnowledgeMarketplaceResolver(registry);
    metrics = new KnowledgeMarketplaceMetrics();
    pipeline = new KnowledgeMarketplacePipeline(
      new KnowledgeMarketplaceValidator(),
      metrics,
      registry,
      resolver,
    );
    registry.register(KnowledgeMarketplaceRegistryBucket.PUBLISHER, publisherFixture());
    registry.register(KnowledgeMarketplaceRegistryBucket.PACKAGE, packageFixture());
  });

  it("runs all 9 stages and returns an updated execution", () => {
    const result = pipeline.run({ execution: executionFixture(), operation: "create_listing" });
    expect(result.auditTrail).toHaveLength(1);
    expect(result.logs).toHaveLength(1);
  });

  it("advances the state machine when targetState differs from current", () => {
    const result = pipeline.run({
      execution: executionFixture(),
      operation: "submit_listing",
      targetState: MarketplacePackageStatus.SUBMITTED,
    });
    expect(result.instance.state).toBe(MarketplacePackageStatus.SUBMITTED);
    expect(result.history).toHaveLength(1);
  });

  it("does not transition when targetState equals current state", () => {
    const result = pipeline.run({
      execution: executionFixture(),
      operation: "noop",
      targetState: MarketplacePackageStatus.DRAFT,
    });
    expect(result.history).toHaveLength(0);
  });

  it("throws MarketplaceValidationException when validation fails", () => {
    const execution = executionFixture({
      metadata: { ...executionFixture().metadata, title: "" },
    });
    expect(() => pipeline.run({ execution, operation: "create_listing" })).toThrow(
      MarketplaceValidationException,
    );
  });

  it("records a validation metric on every run", () => {
    pipeline.run({ execution: executionFixture(), operation: "create_listing" });
    expect(metrics.snapshot().validationCount).toBe(1);
  });

  it("records a validation failure metric when validation fails", () => {
    const execution = executionFixture({
      metadata: { ...executionFixture().metadata, title: "" },
    });
    expect(() => pipeline.run({ execution, operation: "create_listing" })).toThrow();
    expect(metrics.snapshot().validationFailureCount).toBe(1);
  });

  it("normalizes metadata.updatedAt during the Metadata Resolution stage", () => {
    const execution = executionFixture({
      metadata: { ...executionFixture().metadata, updatedAt: "2020-01-01T00:00:00.000Z" },
    });
    const result = pipeline.run({ execution, operation: "create_listing" });
    expect(result.metadata.updatedAt).not.toBe("2020-01-01T00:00:00.000Z");
  });

  it("throws when a Dependency targets an unregistered Package (caught by Validation before Dependency Resolution)", () => {
    const execution = executionFixture({ dependencies: [dependencyFixture()] });
    expect(() => pipeline.run({ execution, operation: "add_dependency" })).toThrow(
      MarketplaceValidationException,
    );
  });

  it("throws MarketplaceDependencyException when the Dependency itself is not registered in the Dependency Registry", () => {
    registry.register(
      KnowledgeMarketplaceRegistryBucket.PACKAGE,
      packageFixture({ id: "package-2", packageId: "package-2" }),
    );
    const execution = executionFixture({ dependencies: [dependencyFixture()] });
    expect(() => pipeline.run({ execution, operation: "add_dependency" })).toThrow(
      MarketplaceDependencyException,
    );
  });

  it("succeeds when the Dependency is registered in both the Package and Dependency Registries", () => {
    registry.register(
      KnowledgeMarketplaceRegistryBucket.PACKAGE,
      packageFixture({ id: "package-2", packageId: "package-2" }),
    );
    const dependency = dependencyFixture();
    registry.register(KnowledgeMarketplaceRegistryBucket.DEPENDENCY, dependency);
    const execution = executionFixture({ dependencies: [dependency] });
    expect(() => pipeline.run({ execution, operation: "add_dependency" })).not.toThrow();
  });

  it("throws MarketplaceCompatibilityException when the platform is not declared compatible", () => {
    const execution = executionFixture({
      compatibility: compatibilityFixture({ platformCompatibility: ["linux"] }),
      context: contextFixture({ metadata: { platform: "windows" } }),
    });
    expect(() => pipeline.run({ execution, operation: "add_compatibility" })).toThrow(
      MarketplaceCompatibilityException,
    );
  });

  it("throws MarketplaceCompatibilityException when the runtime is not declared compatible", () => {
    const execution = executionFixture({
      compatibility: compatibilityFixture({ runtimeCompatibility: ["node"] }),
      context: contextFixture({ metadata: { runtime: "deno" } }),
    });
    expect(() => pipeline.run({ execution, operation: "add_compatibility" })).toThrow(
      MarketplaceCompatibilityException,
    );
  });

  it("succeeds when the platform is declared compatible", () => {
    const execution = executionFixture({
      compatibility: compatibilityFixture({ platformCompatibility: ["windows"] }),
      context: contextFixture({ metadata: { platform: "windows" } }),
    });
    expect(() => pipeline.run({ execution, operation: "add_compatibility" })).not.toThrow();
  });

  it("succeeds when compatibility declares no platform restriction", () => {
    const execution = executionFixture({ compatibility: compatibilityFixture() });
    expect(() => pipeline.run({ execution, operation: "add_compatibility" })).not.toThrow();
  });

  it("stamps an audit entry with fromState/toState/operation", () => {
    const result = pipeline.run({
      execution: executionFixture(),
      operation: "submit_listing",
      targetState: MarketplacePackageStatus.SUBMITTED,
      reason: "ready",
    });
    expect(result.auditTrail[0]?.fromState).toBe(MarketplacePackageStatus.DRAFT);
    expect(result.auditTrail[0]?.toState).toBe(MarketplacePackageStatus.SUBMITTED);
    expect(result.auditTrail[0]?.reason).toBe("ready");
  });

  it("stamps a trace when correlationId is present", () => {
    const result = pipeline.run({ execution: executionFixture(), operation: "create_listing" });
    expect(result.trace?.runCount).toBe(1);
  });

  it("increments trace.runCount across successive runs", () => {
    let execution = executionFixture();
    execution = pipeline.run({ execution, operation: "create_listing" });
    execution = pipeline.run({ execution, operation: "update_listing" });
    expect(execution.trace?.runCount).toBe(2);
  });

  it("throws when the declared category is an unregistered Custom category", () => {
    const execution = executionFixture({
      metadata: { ...executionFixture().metadata, category: "custom" as never },
      package: packageFixture({ category: "custom" as never }),
    });
    expect(() => pipeline.run({ execution, operation: "create_listing" })).toThrow();
  });
});
