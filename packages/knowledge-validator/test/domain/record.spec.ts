import { describe, expect, it } from "vitest";

import { KnowledgeValidationCategory } from "../../src/domain/knowledge-validation-category.js";
import type { KnowledgeValidationExecution } from "../../src/domain/knowledge-validation-execution.js";
import { KnowledgeValidationRecord } from "../../src/domain/knowledge-validation-record.js";
import { KnowledgeValidationState } from "../../src/domain/knowledge-validation-state.js";
import { contextFixture } from "../helpers/context-fixture.js";

const now = "2026-01-01T00:00:00.000Z";

function buildExecution(): KnowledgeValidationExecution {
  const context = contextFixture({ validationId: "v-1" });
  return {
    instance: {
      id: "v-1",
      token: context.token,
      validationId: "v-1",
      tenantId: "t-1",
      state: KnowledgeValidationState.DRAFT,
      createdAt: now,
      updatedAt: now,
    },
    context,
    metadata: {
      validationId: "v-1",
      title: "Title",
      tenantId: "t-1",
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
    request: {
      id: "r-1",
      requestId: "r-1",
      validationId: "v-1",
      category: KnowledgeValidationCategory.STRUCTURE_VALIDATION,
      targetReference: "target-1",
      ruleIds: [],
      requestedBy: "user-1",
      createdAt: now,
    },
    resolvedRules: [],
    findings: [],
    resultMetadata: [],
    history: [],
    auditTrail: [],
    logs: [],
  };
}

describe("KnowledgeValidationRecord", () => {
  it("exposes id from the wrapped instance", () => {
    const record = new KnowledgeValidationRecord(buildExecution());
    expect(record.id).toBe("v-1");
  });

  it("exposes token from the wrapped instance", () => {
    const execution = buildExecution();
    const record = new KnowledgeValidationRecord(execution);
    expect(record.token).toBe(execution.context.token);
  });

  it("exposes validationId", () => {
    const record = new KnowledgeValidationRecord(buildExecution());
    expect(record.validationId).toBe("v-1");
  });

  it("exposes state", () => {
    const record = new KnowledgeValidationRecord(buildExecution());
    expect(record.state).toBe(KnowledgeValidationState.DRAFT);
  });

  it("exposes metadata", () => {
    const record = new KnowledgeValidationRecord(buildExecution());
    expect(record.metadata.title).toBe("Title");
  });

  it("exposes request", () => {
    const record = new KnowledgeValidationRecord(buildExecution());
    expect(record.request.targetReference).toBe("target-1");
  });

  it("exposes context", () => {
    const execution = buildExecution();
    const record = new KnowledgeValidationRecord(execution);
    expect(record.context).toBe(execution.context);
  });

  it("exposes undefined policy when none is set", () => {
    const record = new KnowledgeValidationRecord(buildExecution());
    expect(record.policy).toBeUndefined();
  });

  it("exposes undefined configuration when none is set", () => {
    const record = new KnowledgeValidationRecord(buildExecution());
    expect(record.configuration).toBeUndefined();
  });

  it("exposes an empty findings array by default", () => {
    const record = new KnowledgeValidationRecord(buildExecution());
    expect(record.findings).toEqual([]);
  });

  it("exposes undefined decision when none is set", () => {
    const record = new KnowledgeValidationRecord(buildExecution());
    expect(record.decision).toBeUndefined();
  });

  it("exposes an empty resultMetadata array by default", () => {
    const record = new KnowledgeValidationRecord(buildExecution());
    expect(record.resultMetadata).toEqual([]);
  });

  it("exposes undefined report when none is set", () => {
    const record = new KnowledgeValidationRecord(buildExecution());
    expect(record.report).toBeUndefined();
  });

  it("exposes an empty history array by default", () => {
    const record = new KnowledgeValidationRecord(buildExecution());
    expect(record.history).toEqual([]);
  });

  it("exposes an empty auditTrail array by default", () => {
    const record = new KnowledgeValidationRecord(buildExecution());
    expect(record.auditTrail).toEqual([]);
  });

  it("exposes an empty logs array by default", () => {
    const record = new KnowledgeValidationRecord(buildExecution());
    expect(record.logs).toEqual([]);
  });

  it("toExecution returns the wrapped execution", () => {
    const execution = buildExecution();
    const record = new KnowledgeValidationRecord(execution);
    expect(record.toExecution()).toBe(execution);
  });
});
