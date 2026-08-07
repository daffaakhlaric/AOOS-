import { describe, expect, it } from "vitest";

import { KnowledgePolicyState } from "../../src/domain/knowledge-policy-state.js";
import { PolicyValidationException } from "../../src/errors/policy-validation-exception.js";
import { KnowledgePolicyMetrics } from "../../src/metrics/knowledge-policy-metrics.js";
import { KnowledgePolicyPipeline } from "../../src/pipeline/knowledge-policy-pipeline.js";
import { KnowledgePolicyValidator } from "../../src/validator/knowledge-policy-validator.js";
import { executionFixture } from "../helpers/execution-fixture.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";

function buildPipeline() {
  const validator = new KnowledgePolicyValidator();
  const metrics = new KnowledgePolicyMetrics();
  const pipeline = new KnowledgePolicyPipeline(validator, metrics);
  return { pipeline, metrics };
}

describe("KnowledgePolicyPipeline", () => {
  it("runs all 8 stages successfully and returns an updated execution", () => {
    const { pipeline, metrics } = buildPipeline();
    const execution = executionFixture();
    const result = pipeline.run({
      execution,
      operation: "create_policy",
      targetState: KnowledgePolicyState.CREATED,
    });
    expect(result.instance.state).toBe(KnowledgePolicyState.CREATED);
    expect(result.trace).toBeTruthy();
    expect(result.trace?.runCount).toBe(1);
    expect(result.auditTrail).toHaveLength(1);
    expect(result.logs).toHaveLength(1);
    expect(metrics.snapshot().validationCount).toBe(1);
    expect(metrics.snapshot().validationFailureCount).toBe(0);
    expect(metrics.snapshot().policyCount).toBe(1);
  });

  it("throws PolicyValidationException when validation fails", () => {
    const { pipeline } = buildPipeline();
    const execution = executionFixture({ metadata: metadataFixture({ policyId: "" }) });
    expect(() => pipeline.run({ execution, operation: "create_policy" })).toThrow(
      PolicyValidationException,
    );
  });

  it("records a failed validation count when validation fails", () => {
    const { pipeline, metrics } = buildPipeline();
    const execution = executionFixture({ metadata: metadataFixture({ policyId: "" }) });
    expect(() => pipeline.run({ execution, operation: "create_policy" })).toThrow();
    expect(metrics.snapshot().validationFailureCount).toBe(1);
  });

  it("does not transition state when no targetState is supplied", () => {
    const { pipeline } = buildPipeline();
    const execution = executionFixture();
    const result = pipeline.run({ execution, operation: "evaluate_policy" });
    expect(result.instance.state).toBe(execution.instance.state);
    expect(result.history).toHaveLength(0);
  });

  it("stamps audit trail with fromState/toState/reason", () => {
    const { pipeline } = buildPipeline();
    const execution = executionFixture();
    const result = pipeline.run({
      execution,
      operation: "create_policy",
      targetState: KnowledgePolicyState.CREATED,
      reason: "initial creation",
    });
    expect(result.auditTrail[0]?.fromState).toBe(KnowledgePolicyState.DRAFT);
    expect(result.auditTrail[0]?.toState).toBe(KnowledgePolicyState.CREATED);
    expect(result.auditTrail[0]?.reason).toBe("initial creation");
  });

  it("increments trace runCount across repeated pipeline runs", () => {
    const { pipeline } = buildPipeline();
    let execution = executionFixture();
    execution = pipeline.run({
      execution,
      operation: "create_policy",
      targetState: KnowledgePolicyState.CREATED,
    });
    execution = pipeline.run({
      execution,
      operation: "validate_policy",
      targetState: KnowledgePolicyState.VALIDATED,
    });
    expect(execution.trace?.runCount).toBe(2);
  });

  it("uses the supplied traceId when present on the context", () => {
    const { pipeline } = buildPipeline();
    const execution = executionFixture({
      context: { ...executionFixture().context, traceId: "trace-fixed" },
    });
    const result = pipeline.run({
      execution,
      operation: "create_policy",
      targetState: KnowledgePolicyState.CREATED,
    });
    expect(result.trace?.traceId).toBe("trace-fixed");
  });

  it("appends a log entry describing the completed operation", () => {
    const { pipeline } = buildPipeline();
    const execution = executionFixture();
    const result = pipeline.run({ execution, operation: "evaluate_policy" });
    expect(result.logs[0]?.operation).toBe("evaluate_policy");
    expect(result.logs[0]?.level).toBe("info");
    expect(result.logs[0]?.message).toContain("evaluate_policy");
  });
});
