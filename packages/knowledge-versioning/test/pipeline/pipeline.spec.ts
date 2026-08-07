import { describe, expect, it } from "vitest";

import { KnowledgeVersionOperation } from "../../src/domain/knowledge-version-operation.js";
import { KnowledgeVersionState } from "../../src/domain/knowledge-version-state.js";
import { KnowledgeVersionType } from "../../src/domain/knowledge-version-type.js";
import { VersionPermissionDeniedException } from "../../src/errors/version-permission-denied-exception.js";
import { VersionPolicyViolationException } from "../../src/errors/version-policy-violation-exception.js";
import { VersionValidationException } from "../../src/errors/version-validation-exception.js";
import { KnowledgeVersionMetrics } from "../../src/metrics/knowledge-version-metrics.js";
import { KnowledgeVersionPermission } from "../../src/permission/knowledge-version-permission.js";
import { KnowledgeVersionPipeline } from "../../src/pipeline/knowledge-version-pipeline.js";
import { KnowledgeVersionPolicy } from "../../src/policy/knowledge-version-policy.js";
import { KnowledgeVersionValidator } from "../../src/validator/knowledge-version-validator.js";
import { executionFixture } from "../helpers/execution-fixture.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";

function buildPipeline() {
  // Validator gets its own, separately-scoped Policy/Permission instances so tests can
  // exercise the Pipeline's own Permission (stage 2) / Policy (stage 3) checks
  // independently of the Validator's built-in Policy (stage 6) / Permission (stage 7)
  // stages, which would otherwise always fail first.
  const validatorPolicy = new KnowledgeVersionPolicy();
  const validatorPermission = new KnowledgeVersionPermission();
  const validator = new KnowledgeVersionValidator({
    policy: validatorPolicy,
    permission: validatorPermission,
  });
  const policy = new KnowledgeVersionPolicy();
  const permission = new KnowledgeVersionPermission();
  const metrics = new KnowledgeVersionMetrics();
  const pipeline = new KnowledgeVersionPipeline(validator, permission, policy, metrics);
  return { pipeline, policy, permission, metrics };
}

describe("KnowledgeVersionPipeline", () => {
  it("runs all 8 stages successfully and returns an updated execution", async () => {
    const { pipeline, metrics } = buildPipeline();
    const execution = executionFixture();
    const result = await pipeline.run({
      execution,
      context: execution.context,
      operation: KnowledgeVersionOperation.CREATE_VERSION,
      targetState: KnowledgeVersionState.CREATED,
    });
    expect(result.instance.state).toBe(KnowledgeVersionState.CREATED);
    expect(result.trace).toBeTruthy();
    expect(result.trace?.runCount).toBe(1);
    expect(result.auditTrail).toHaveLength(1);
    expect(result.logs).toHaveLength(1);
    expect(metrics.snapshot().validationCount).toBe(1);
    expect(metrics.snapshot().validationFailureCount).toBe(0);
  });

  it("throws VersionValidationException when validation fails", async () => {
    const { pipeline } = buildPipeline();
    const execution = executionFixture({ metadata: metadataFixture({ versionId: "" }) });
    await expect(
      pipeline.run({
        execution,
        context: execution.context,
        operation: KnowledgeVersionOperation.CREATE_VERSION,
      }),
    ).rejects.toThrow(VersionValidationException);
  });

  it("throws VersionPermissionDeniedException when permission denies", async () => {
    const { pipeline, permission } = buildPipeline();
    permission.register({
      id: "deny-1",
      scope: { tenantId: "tenant-1" },
      effect: "deny",
      createdAt: new Date().toISOString(),
    });
    const execution = executionFixture();
    await expect(
      pipeline.run({
        execution,
        context: execution.context,
        operation: KnowledgeVersionOperation.CREATE_VERSION,
      }),
    ).rejects.toThrow(VersionPermissionDeniedException);
  });

  it("throws VersionPolicyViolationException when policy denies", async () => {
    const { pipeline, policy } = buildPipeline();
    policy.register({
      id: "deny-major",
      name: "deny-major",
      scope: { tenantId: "tenant-1" },
      enabled: true,
      deniedVersionTypes: [KnowledgeVersionType.MAJOR],
      createdAt: new Date().toISOString(),
    });
    const execution = executionFixture();
    await expect(
      pipeline.run({
        execution,
        context: execution.context,
        operation: KnowledgeVersionOperation.CREATE_VERSION,
      }),
    ).rejects.toThrow(VersionPolicyViolationException);
  });

  it("records a failed validation-count sample on any thrown error", async () => {
    const { pipeline, metrics } = buildPipeline();
    const execution = executionFixture({ metadata: metadataFixture({ versionId: "" }) });
    await expect(
      pipeline.run({
        execution,
        context: execution.context,
        operation: KnowledgeVersionOperation.CREATE_VERSION,
      }),
    ).rejects.toThrow();
    expect(metrics.snapshot().validationFailureCount).toBe(1);
  });

  it("does not transition state when no targetState is supplied", async () => {
    const { pipeline } = buildPipeline();
    const execution = executionFixture();
    const result = await pipeline.run({
      execution,
      context: execution.context,
      operation: KnowledgeVersionOperation.COMPARE_VERSION,
    });
    expect(result.instance.state).toBe(execution.instance.state);
    expect(result.history).toHaveLength(0);
  });

  it("increments trace runCount across repeated pipeline runs", async () => {
    const { pipeline } = buildPipeline();
    let execution = executionFixture();
    execution = await pipeline.run({
      execution,
      context: execution.context,
      operation: KnowledgeVersionOperation.CREATE_VERSION,
      targetState: KnowledgeVersionState.CREATED,
    });
    execution = await pipeline.run({
      execution,
      context: execution.context,
      operation: KnowledgeVersionOperation.CREATE_VERSION,
      targetState: KnowledgeVersionState.VALIDATED,
    });
    expect(execution.trace?.runCount).toBe(2);
  });

  it("uses the supplied traceId when present on the context", async () => {
    const { pipeline } = buildPipeline();
    const execution = executionFixture({
      context: { ...executionFixture().context, traceId: "trace-fixed" },
    });
    const result = await pipeline.run({
      execution,
      context: execution.context,
      operation: KnowledgeVersionOperation.CREATE_VERSION,
      targetState: KnowledgeVersionState.CREATED,
    });
    expect(result.trace?.traceId).toBe("trace-fixed");
  });
});
