import type { KnowledgeQualityAssessmentMetadata } from "../domain/knowledge-quality-assessment-metadata.js";
import { KnowledgeQualityAssessmentState } from "../domain/knowledge-quality-assessment-state.js";
import type { KnowledgeQualityAssessment } from "../domain/knowledge-quality-assessment.js";
import type { KnowledgeQualityDimension } from "../domain/knowledge-quality-dimension.js";
import type {
  KnowledgeQualityFinding,
  KnowledgeQualityFindingSeverity,
} from "../domain/knowledge-quality-finding.js";
import type { KnowledgeQualityProfile } from "../domain/knowledge-quality-profile.js";
import type { KnowledgeQualityReport } from "../domain/knowledge-quality-report.js";
import type { KnowledgeQualityRule } from "../domain/knowledge-quality-rule.js";
import { generateId } from "../utils/id.js";

/** "AssessmentFactory" (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md — "Factory") — creates `KnowledgeQualityAssessment` instance envelopes. */
class AssessmentFactory {
  create(input: {
    token: string;
    assessmentId: string;
    tenantId: string;
    workspaceId?: string;
  }): KnowledgeQualityAssessment {
    const now = new Date().toISOString();
    return {
      id: input.assessmentId,
      token: input.token,
      assessmentId: input.assessmentId,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      state: KnowledgeQualityAssessmentState.DRAFT,
      createdAt: now,
      updatedAt: now,
    };
  }
}

/** "FindingFactory" — creates `KnowledgeQualityFinding` records (never computed by this package — always recorded on behalf of a caller). */
class FindingFactory {
  create(input: {
    assessmentId: string;
    tenantId: string;
    dimension: KnowledgeQualityDimension;
    severity: KnowledgeQualityFindingSeverity;
    description: string;
    locationReference?: string;
    ruleId?: string;
  }): KnowledgeQualityFinding {
    const findingId = generateId();
    return {
      id: findingId,
      findingId,
      assessmentId: input.assessmentId,
      tenantId: input.tenantId,
      dimension: input.dimension,
      severity: input.severity,
      description: input.description,
      locationReference: input.locationReference,
      ruleId: input.ruleId,
      createdAt: new Date().toISOString(),
    };
  }
}

/** "RuleFactory" — creates `KnowledgeQualityRule` records (metadata only, no executable rule logic). */
class RuleFactory {
  create(input: {
    ruleId: string;
    name: string;
    tenantId: string;
    dimension: KnowledgeQualityDimension;
    description?: string;
    severity?: KnowledgeQualityFindingSeverity;
    active?: boolean;
  }): KnowledgeQualityRule {
    const now = new Date().toISOString();
    return {
      id: input.ruleId,
      ruleId: input.ruleId,
      name: input.name,
      description: input.description,
      tenantId: input.tenantId,
      dimension: input.dimension,
      severity: input.severity ?? "medium",
      active: input.active ?? true,
      createdAt: now,
      updatedAt: now,
    };
  }
}

/** "ProfileFactory" — creates `KnowledgeQualityProfile` records (a named bundle of Rule ids + Dimension weights, metadata only). */
class ProfileFactory {
  create(input: {
    profileId: string;
    name: string;
    tenantId: string;
    ruleIds?: readonly string[];
    dimensionWeights?: Readonly<Partial<Record<KnowledgeQualityDimension, number>>>;
    description?: string;
    active?: boolean;
  }): KnowledgeQualityProfile {
    const now = new Date().toISOString();
    return {
      id: input.profileId,
      profileId: input.profileId,
      name: input.name,
      description: input.description,
      tenantId: input.tenantId,
      ruleIds: [...(input.ruleIds ?? [])],
      dimensionWeights: { ...(input.dimensionWeights ?? {}) },
      active: input.active ?? true,
      createdAt: now,
      updatedAt: now,
    };
  }
}

/** "ReportFactory" — creates `KnowledgeQualityReport` records: aggregates Finding + Score Metadata ids for a completed Assessment, never renders anything. */
class ReportFactory {
  create(input: {
    assessmentId: string;
    tenantId: string;
    findingIds?: readonly string[];
    scoreMetadataIds?: readonly string[];
    summary?: string;
  }): KnowledgeQualityReport {
    const reportId = generateId();
    return {
      id: reportId,
      reportId,
      assessmentId: input.assessmentId,
      tenantId: input.tenantId,
      findingIds: [...(input.findingIds ?? [])],
      scoreMetadataIds: [...(input.scoreMetadataIds ?? [])],
      summary: input.summary,
      generatedAt: new Date().toISOString(),
    };
  }
}

/** "MetadataFactory" — creates `KnowledgeQualityAssessmentMetadata` records. */
class MetadataFactory {
  create(input: {
    assessmentId: string;
    title: string;
    tenantId: string;
    description?: string;
    workspaceId?: string;
    tags?: readonly string[];
    createdBy?: string;
  }): KnowledgeQualityAssessmentMetadata {
    const now = new Date().toISOString();
    return {
      assessmentId: input.assessmentId,
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
 * "FACTORY: Assessment Factory, Finding Factory, Rule Factory, Profile Factory, Report
 * Factory, Metadata Factory." (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md) —
 * "KnowledgeQualityFactory" composes the 6 named sub-factories as `readonly` fields.
 */
export class KnowledgeQualityFactory {
  readonly assessment = new AssessmentFactory();
  readonly finding = new FindingFactory();
  readonly rule = new RuleFactory();
  readonly profile = new ProfileFactory();
  readonly report = new ReportFactory();
  readonly metadata = new MetadataFactory();
}
