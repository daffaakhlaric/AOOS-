import { describe, expect, it } from "vitest";

import { KnowledgeQualityAssessmentMode } from "../../src/domain/knowledge-quality-assessment-mode.js";
import { KnowledgeQualityAssessmentRecord } from "../../src/domain/knowledge-quality-assessment-record.js";
import { KnowledgeQualityAssessmentState } from "../../src/domain/knowledge-quality-assessment-state.js";
import type { KnowledgeQualityExecution } from "../../src/domain/knowledge-quality-execution.js";
import { contextFixture } from "../helpers/context-fixture.js";

const now = new Date().toISOString();

function buildExecution(): KnowledgeQualityExecution {
  const context = contextFixture({ assessmentId: "g-1", token: "kqua_record" });
  return {
    instance: {
      id: "g-1",
      token: "kqua_record",
      assessmentId: "g-1",
      tenantId: "tenant-1",
      state: KnowledgeQualityAssessmentState.DRAFT,
      createdAt: now,
      updatedAt: now,
    },
    context,
    metadata: {
      assessmentId: "g-1",
      title: "Title",
      tenantId: "tenant-1",
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
    request: {
      id: "r-1",
      requestId: "r-1",
      assessmentId: "g-1",
      mode: KnowledgeQualityAssessmentMode.FULL_ASSESSMENT,
      targetReference: "target-1",
      ruleIds: [],
      requestedBy: "user-1",
      createdAt: now,
    },
    resolvedRules: [],
    findings: [],
    scoreMetadata: [],
    history: [],
    auditTrail: [],
    logs: [],
  };
}

describe("KnowledgeQualityAssessmentRecord", () => {
  it("exposes id/token/assessmentId/state", () => {
    const record = new KnowledgeQualityAssessmentRecord(buildExecution());
    expect(record.id).toBe("g-1");
    expect(record.token).toBe("kqua_record");
    expect(record.assessmentId).toBe("g-1");
    expect(record.state).toBe(KnowledgeQualityAssessmentState.DRAFT);
  });

  it("exposes metadata/request/context", () => {
    const record = new KnowledgeQualityAssessmentRecord(buildExecution());
    expect(record.metadata.title).toBe("Title");
    expect(record.request.mode).toBe(KnowledgeQualityAssessmentMode.FULL_ASSESSMENT);
    expect(record.context.tenantId).toBe("tenant-1");
  });

  it("exposes undefined optional fields when unresolved", () => {
    const record = new KnowledgeQualityAssessmentRecord(buildExecution());
    expect(record.report).toBeUndefined();
    expect(record.policy).toBeUndefined();
    expect(record.profile).toBeUndefined();
    expect(record.configuration).toBeUndefined();
  });

  it("exposes empty findings/scoreMetadata/history/auditTrail/logs on a fresh execution", () => {
    const record = new KnowledgeQualityAssessmentRecord(buildExecution());
    expect(record.findings).toEqual([]);
    expect(record.scoreMetadata).toEqual([]);
    expect(record.history).toEqual([]);
    expect(record.auditTrail).toEqual([]);
    expect(record.logs).toEqual([]);
  });

  it("toExecution() returns the underlying execution envelope", () => {
    const execution = buildExecution();
    const record = new KnowledgeQualityAssessmentRecord(execution);
    expect(record.toExecution()).toBe(execution);
  });
});
