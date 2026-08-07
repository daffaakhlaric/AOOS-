import { describe, expect, it } from "vitest";

import { knowledgeValidationAuditSchema } from "../../src/domain/knowledge-validation-audit.js";
import { KnowledgeValidationCategory } from "../../src/domain/knowledge-validation-category.js";
import { knowledgeValidationConfigurationSchema } from "../../src/domain/knowledge-validation-configuration.js";
import { KnowledgeValidationDecisionValue } from "../../src/domain/knowledge-validation-decision-value.js";
import { knowledgeValidationDecisionSchema } from "../../src/domain/knowledge-validation-decision.js";
import {
  KNOWLEDGE_VALIDATION_FINDING_SEVERITIES,
  knowledgeValidationFindingSchema,
} from "../../src/domain/knowledge-validation-finding.js";
import { knowledgeValidationJobSchema } from "../../src/domain/knowledge-validation-job.js";
import { knowledgeValidationMetadataSchema } from "../../src/domain/knowledge-validation-metadata.js";
import {
  evaluateKnowledgeValidationPolicy,
  knowledgeValidationPolicySchema,
} from "../../src/domain/knowledge-validation-policy.js";
import { knowledgeValidationReportSchema } from "../../src/domain/knowledge-validation-report.js";
import { knowledgeValidationRequestSchema } from "../../src/domain/knowledge-validation-request.js";
import { knowledgeValidationResultMetadataSchema } from "../../src/domain/knowledge-validation-result-metadata.js";
import { knowledgeValidationRuleSchema } from "../../src/domain/knowledge-validation-rule.js";
import { KnowledgeValidationSessionState } from "../../src/domain/knowledge-validation-session-state.js";
import { knowledgeValidationSessionSchema } from "../../src/domain/knowledge-validation-session.js";
import { KnowledgeValidationState } from "../../src/domain/knowledge-validation-state.js";
import { EMPTY_KNOWLEDGE_VALIDATION_STATISTICS } from "../../src/domain/knowledge-validation-statistics-snapshot.js";
import { knowledgeValidationSchema } from "../../src/domain/knowledge-validation.js";

const now = "2026-01-01T00:00:00.000Z";

describe("knowledgeValidationSchema", () => {
  it("parses a valid record", () => {
    expect(() =>
      knowledgeValidationSchema.parse({
        id: "v-1",
        token: "kval_1",
        validationId: "v-1",
        tenantId: "t-1",
        state: KnowledgeValidationState.DRAFT,
        createdAt: now,
        updatedAt: now,
      }),
    ).not.toThrow();
  });

  it("rejects a blank validationId", () => {
    expect(() =>
      knowledgeValidationSchema.parse({
        id: "v-1",
        token: "kval_1",
        validationId: "",
        tenantId: "t-1",
        state: KnowledgeValidationState.DRAFT,
        createdAt: now,
        updatedAt: now,
      }),
    ).toThrow();
  });

  it("rejects an unknown state", () => {
    expect(() =>
      knowledgeValidationSchema.parse({
        id: "v-1",
        token: "kval_1",
        validationId: "v-1",
        tenantId: "t-1",
        state: "unknown",
        createdAt: now,
        updatedAt: now,
      }),
    ).toThrow();
  });
});

describe("knowledgeValidationJobSchema", () => {
  it("parses a valid record", () => {
    expect(() =>
      knowledgeValidationJobSchema.parse({
        id: "j-1",
        jobId: "j-1",
        validationId: "v-1",
        tenantId: "t-1",
        priority: 5,
        createdAt: now,
      }),
    ).not.toThrow();
  });

  it("defaults priority to 5", () => {
    const job = knowledgeValidationJobSchema.parse({
      id: "j-1",
      jobId: "j-1",
      validationId: "v-1",
      tenantId: "t-1",
      createdAt: now,
    });
    expect(job.priority).toBe(5);
  });

  it("rejects priority above 9", () => {
    expect(() =>
      knowledgeValidationJobSchema.parse({
        id: "j-1",
        jobId: "j-1",
        validationId: "v-1",
        tenantId: "t-1",
        priority: 10,
        createdAt: now,
      }),
    ).toThrow();
  });
});

describe("knowledgeValidationSessionSchema", () => {
  it("parses a valid record", () => {
    expect(() =>
      knowledgeValidationSessionSchema.parse({
        id: "s-1",
        sessionId: "s-1",
        validationId: "v-1",
        tenantId: "t-1",
        holder: "user-1",
        state: KnowledgeValidationSessionState.OPEN,
        openedAt: now,
      }),
    ).not.toThrow();
  });

  it("rejects a blank holder", () => {
    expect(() =>
      knowledgeValidationSessionSchema.parse({
        id: "s-1",
        sessionId: "s-1",
        validationId: "v-1",
        tenantId: "t-1",
        holder: "",
        state: KnowledgeValidationSessionState.OPEN,
        openedAt: now,
      }),
    ).toThrow();
  });
});

describe("knowledgeValidationRequestSchema", () => {
  const base = {
    id: "r-1",
    requestId: "r-1",
    validationId: "v-1",
    category: KnowledgeValidationCategory.STRUCTURE_VALIDATION,
    targetReference: "target-1",
    ruleIds: [],
    requestedBy: "user-1",
    createdAt: now,
  };

  it("parses a valid record", () => {
    expect(() => knowledgeValidationRequestSchema.parse(base)).not.toThrow();
  });

  it("rejects a blank targetReference", () => {
    expect(() =>
      knowledgeValidationRequestSchema.parse({ ...base, targetReference: "" }),
    ).toThrow();
  });

  it("rejects an unknown category", () => {
    expect(() =>
      knowledgeValidationRequestSchema.parse({ ...base, category: "unknown" }),
    ).toThrow();
  });
});

describe("knowledgeValidationMetadataSchema", () => {
  const base = {
    validationId: "v-1",
    title: "Title",
    tenantId: "t-1",
    tags: [],
    createdAt: now,
    updatedAt: now,
  };

  it("parses a valid record", () => {
    expect(() => knowledgeValidationMetadataSchema.parse(base)).not.toThrow();
  });

  it("rejects a blank title", () => {
    expect(() => knowledgeValidationMetadataSchema.parse({ ...base, title: "" })).toThrow();
  });
});

describe("knowledgeValidationRuleSchema", () => {
  const base = {
    id: "rule-1",
    ruleId: "rule-1",
    name: "Rule",
    tenantId: "t-1",
    category: KnowledgeValidationCategory.SECURITY_VALIDATION,
    createdAt: now,
    updatedAt: now,
  };

  it("parses a valid record", () => {
    expect(() => knowledgeValidationRuleSchema.parse(base)).not.toThrow();
  });

  it("defaults severity to medium", () => {
    const rule = knowledgeValidationRuleSchema.parse(base);
    expect(rule.severity).toBe("medium");
  });

  it("defaults active to true", () => {
    const rule = knowledgeValidationRuleSchema.parse(base);
    expect(rule.active).toBe(true);
  });
});

describe("knowledgeValidationPolicySchema + evaluateKnowledgeValidationPolicy", () => {
  const base = {
    id: "p-1",
    policyId: "p-1",
    name: "Policy",
    tenantId: "t-1",
    allowedCategories: [],
    createdAt: now,
    updatedAt: now,
  };

  it("parses a valid record", () => {
    expect(() => knowledgeValidationPolicySchema.parse(base)).not.toThrow();
  });

  it("defaults active to true and requireApproval to false", () => {
    const policy = knowledgeValidationPolicySchema.parse(base);
    expect(policy.active).toBe(true);
    expect(policy.requireApproval).toBe(false);
  });

  it("denies when the policy is inactive", () => {
    const policy = knowledgeValidationPolicySchema.parse({ ...base, active: false });
    const result = evaluateKnowledgeValidationPolicy(policy, {
      categories: [],
      category: KnowledgeValidationCategory.STRUCTURE_VALIDATION,
    });
    expect(result.allowed).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("allows everything when allowedCategories is empty (permissive by omission)", () => {
    const policy = knowledgeValidationPolicySchema.parse(base);
    const result = evaluateKnowledgeValidationPolicy(policy, {
      categories: [KnowledgeValidationCategory.SECURITY_VALIDATION],
      category: KnowledgeValidationCategory.STRUCTURE_VALIDATION,
    });
    expect(result.allowed).toBe(true);
  });

  it("denies a category not in the allow-list", () => {
    const policy = knowledgeValidationPolicySchema.parse({
      ...base,
      allowedCategories: [KnowledgeValidationCategory.SECURITY_VALIDATION],
    });
    const result = evaluateKnowledgeValidationPolicy(policy, {
      categories: [],
      category: KnowledgeValidationCategory.STRUCTURE_VALIDATION,
    });
    expect(result.allowed).toBe(false);
  });

  it("allows a category present in the allow-list", () => {
    const policy = knowledgeValidationPolicySchema.parse({
      ...base,
      allowedCategories: [KnowledgeValidationCategory.STRUCTURE_VALIDATION],
    });
    const result = evaluateKnowledgeValidationPolicy(policy, {
      categories: [KnowledgeValidationCategory.STRUCTURE_VALIDATION],
      category: KnowledgeValidationCategory.STRUCTURE_VALIDATION,
    });
    expect(result.allowed).toBe(true);
  });

  it("flags disallowed rule categories individually", () => {
    const policy = knowledgeValidationPolicySchema.parse({
      ...base,
      allowedCategories: [KnowledgeValidationCategory.STRUCTURE_VALIDATION],
    });
    const result = evaluateKnowledgeValidationPolicy(policy, {
      categories: [
        KnowledgeValidationCategory.STRUCTURE_VALIDATION,
        KnowledgeValidationCategory.SECURITY_VALIDATION,
      ],
      category: KnowledgeValidationCategory.STRUCTURE_VALIDATION,
    });
    expect(result.allowed).toBe(false);
    expect(result.reasons.some((reason) => reason.includes("security_validation"))).toBe(true);
  });
});

describe("knowledgeValidationConfigurationSchema", () => {
  const base = {
    id: "c-1",
    configurationId: "c-1",
    validationId: "v-1",
    tenantId: "t-1",
    custom: {},
    createdAt: now,
  };

  it("parses a valid record", () => {
    expect(() => knowledgeValidationConfigurationSchema.parse(base)).not.toThrow();
  });

  it("rejects a non-positive timeoutMs", () => {
    expect(() => knowledgeValidationConfigurationSchema.parse({ ...base, timeoutMs: 0 })).toThrow();
  });

  it("rejects retries above 10", () => {
    expect(() => knowledgeValidationConfigurationSchema.parse({ ...base, retries: 11 })).toThrow();
  });
});

describe("knowledgeValidationDecisionSchema", () => {
  const base = {
    id: "d-1",
    decisionId: "d-1",
    validationId: "v-1",
    tenantId: "t-1",
    value: KnowledgeValidationDecisionValue.APPROVED,
    reportedBy: "user-1",
    recordedAt: now,
  };

  it("parses a valid record", () => {
    expect(() => knowledgeValidationDecisionSchema.parse(base)).not.toThrow();
  });

  it("rejects confidence above 1", () => {
    expect(() => knowledgeValidationDecisionSchema.parse({ ...base, confidence: 1.5 })).toThrow();
  });

  it("rejects an unknown decision value", () => {
    expect(() => knowledgeValidationDecisionSchema.parse({ ...base, value: "unknown" })).toThrow();
  });
});

describe("knowledgeValidationFindingSchema", () => {
  const base = {
    id: "f-1",
    findingId: "f-1",
    validationId: "v-1",
    tenantId: "t-1",
    category: KnowledgeValidationCategory.SECURITY_VALIDATION,
    severity: "high" as const,
    description: "issue",
    createdAt: now,
  };

  it("parses a valid record", () => {
    expect(() => knowledgeValidationFindingSchema.parse(base)).not.toThrow();
  });

  it("rejects a blank description", () => {
    expect(() => knowledgeValidationFindingSchema.parse({ ...base, description: "" })).toThrow();
  });

  it("KNOWLEDGE_VALIDATION_FINDING_SEVERITIES has exactly 5 entries", () => {
    expect(KNOWLEDGE_VALIDATION_FINDING_SEVERITIES).toHaveLength(5);
  });
});

describe("knowledgeValidationReportSchema", () => {
  it("parses a valid record", () => {
    expect(() =>
      knowledgeValidationReportSchema.parse({
        id: "rep-1",
        reportId: "rep-1",
        validationId: "v-1",
        tenantId: "t-1",
        findingIds: [],
        generatedAt: now,
      }),
    ).not.toThrow();
  });
});

describe("knowledgeValidationResultMetadataSchema", () => {
  it("parses a valid record", () => {
    expect(() =>
      knowledgeValidationResultMetadataSchema.parse({
        id: "res-1",
        resultId: "res-1",
        validationId: "v-1",
        tenantId: "t-1",
        outcome: "flagged",
        providerId: "provider-1",
        recordedAt: now,
      }),
    ).not.toThrow();
  });

  it("rejects a blank outcome", () => {
    expect(() =>
      knowledgeValidationResultMetadataSchema.parse({
        id: "res-1",
        resultId: "res-1",
        validationId: "v-1",
        tenantId: "t-1",
        outcome: "",
        providerId: "provider-1",
        recordedAt: now,
      }),
    ).toThrow();
  });
});

describe("knowledgeValidationAuditSchema", () => {
  it("parses a valid record", () => {
    expect(() =>
      knowledgeValidationAuditSchema.parse({
        id: "a-1",
        auditId: "a-1",
        validationId: "v-1",
        tenantId: "t-1",
        operation: "create_validation",
        occurredAt: now,
      }),
    ).not.toThrow();
  });
});

describe("EMPTY_KNOWLEDGE_VALIDATION_STATISTICS", () => {
  it("starts every counter at zero", () => {
    expect(EMPTY_KNOWLEDGE_VALIDATION_STATISTICS).toEqual({
      requestedCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
    });
  });
});
