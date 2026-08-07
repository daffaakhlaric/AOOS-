import type { KnowledgeValidationCategory } from "../domain/knowledge-validation-category.js";
import type { KnowledgeValidationDecisionValue } from "../domain/knowledge-validation-decision-value.js";
import type { KnowledgeValidationDecision } from "../domain/knowledge-validation-decision.js";
import type {
  KnowledgeValidationFinding,
  KnowledgeValidationFindingSeverity,
} from "../domain/knowledge-validation-finding.js";
import type { KnowledgeValidationMetadata } from "../domain/knowledge-validation-metadata.js";
import type { KnowledgeValidationReport } from "../domain/knowledge-validation-report.js";
import type { KnowledgeValidationRule } from "../domain/knowledge-validation-rule.js";
import { KnowledgeValidationState } from "../domain/knowledge-validation-state.js";
import type { KnowledgeValidation } from "../domain/knowledge-validation.js";
import { generateId } from "../utils/id.js";

/** "ValidationFactory" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md — "Factory") — creates `KnowledgeValidation` instance envelopes. */
class ValidationFactory {
  create(input: {
    token: string;
    validationId: string;
    tenantId: string;
    workspaceId?: string;
  }): KnowledgeValidation {
    const now = new Date().toISOString();
    return {
      id: input.validationId,
      token: input.token,
      validationId: input.validationId,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      state: KnowledgeValidationState.DRAFT,
      createdAt: now,
      updatedAt: now,
    };
  }
}

/** "DecisionFactory" — creates `KnowledgeValidationDecision` records (never computed by this package — always recorded on behalf of a caller-supplied `IKnowledgeValidationDecisionProvider`/reviewer). */
class DecisionFactory {
  create(input: {
    validationId: string;
    tenantId: string;
    value: KnowledgeValidationDecisionValue;
    reportedBy: string;
    confidence?: number;
    reason?: string;
  }): KnowledgeValidationDecision {
    const decisionId = generateId();
    return {
      id: decisionId,
      decisionId,
      validationId: input.validationId,
      tenantId: input.tenantId,
      value: input.value,
      reportedBy: input.reportedBy,
      confidence: input.confidence,
      reason: input.reason,
      recordedAt: new Date().toISOString(),
    };
  }
}

/** "RuleFactory" — creates `KnowledgeValidationRule` records (metadata only, no executable rule logic). */
class RuleFactory {
  create(input: {
    ruleId: string;
    name: string;
    tenantId: string;
    category: KnowledgeValidationCategory;
    description?: string;
    severity?: KnowledgeValidationFindingSeverity;
    active?: boolean;
  }): KnowledgeValidationRule {
    const now = new Date().toISOString();
    return {
      id: input.ruleId,
      ruleId: input.ruleId,
      name: input.name,
      description: input.description,
      tenantId: input.tenantId,
      category: input.category,
      severity: input.severity ?? "medium",
      active: input.active ?? true,
      createdAt: now,
      updatedAt: now,
    };
  }
}

/** "FindingFactory" — creates `KnowledgeValidationFinding` records (never computed by this package — always recorded on behalf of a caller). */
class FindingFactory {
  create(input: {
    validationId: string;
    tenantId: string;
    category: KnowledgeValidationCategory;
    severity: KnowledgeValidationFindingSeverity;
    description: string;
    locationReference?: string;
    ruleId?: string;
  }): KnowledgeValidationFinding {
    const findingId = generateId();
    return {
      id: findingId,
      findingId,
      validationId: input.validationId,
      tenantId: input.tenantId,
      category: input.category,
      severity: input.severity,
      description: input.description,
      locationReference: input.locationReference,
      ruleId: input.ruleId,
      createdAt: new Date().toISOString(),
    };
  }
}

/** "ReportFactory" — creates `KnowledgeValidationReport` records: aggregates Finding ids + a Decision id for a settled Validation, never renders anything. */
class ReportFactory {
  create(input: {
    validationId: string;
    tenantId: string;
    findingIds?: readonly string[];
    decisionId?: string;
    summary?: string;
  }): KnowledgeValidationReport {
    const reportId = generateId();
    return {
      id: reportId,
      reportId,
      validationId: input.validationId,
      tenantId: input.tenantId,
      findingIds: [...(input.findingIds ?? [])],
      decisionId: input.decisionId,
      summary: input.summary,
      generatedAt: new Date().toISOString(),
    };
  }
}

/** "MetadataFactory" — creates `KnowledgeValidationMetadata` records. */
class MetadataFactory {
  create(input: {
    validationId: string;
    title: string;
    tenantId: string;
    description?: string;
    workspaceId?: string;
    tags?: readonly string[];
    createdBy?: string;
  }): KnowledgeValidationMetadata {
    const now = new Date().toISOString();
    return {
      validationId: input.validationId,
      title: input.title,
      description: input.description,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      tags: [...(input.tags ?? [])],
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };
  }
}

/**
 * "FACTORY: Validation Factory, Decision Factory, Rule Factory, Finding Factory,
 * Report Factory, Metadata Factory." (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md) —
 * "KnowledgeValidatorFactory" composes the 6 named sub-factories as `readonly` fields.
 */
export class KnowledgeValidatorFactory {
  readonly validation = new ValidationFactory();
  readonly decision = new DecisionFactory();
  readonly rule = new RuleFactory();
  readonly finding = new FindingFactory();
  readonly report = new ReportFactory();
  readonly metadata = new MetadataFactory();
}
