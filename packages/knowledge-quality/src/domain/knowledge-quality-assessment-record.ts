import type { KnowledgeQualityContext } from "../context/knowledge-quality-context.js";
import type { IKnowledgeQuality } from "../contracts/i-knowledge-quality.js";

import type { KnowledgeQualityAssessmentAudit } from "./knowledge-quality-assessment-audit.js";
import type { KnowledgeQualityAssessmentHistoryEntry } from "./knowledge-quality-assessment-history-entry.js";
import type { KnowledgeQualityAssessmentLogEntry } from "./knowledge-quality-assessment-log-entry.js";
import type { KnowledgeQualityAssessmentMetadata } from "./knowledge-quality-assessment-metadata.js";
import type { KnowledgeQualityAssessmentRequest } from "./knowledge-quality-assessment-request.js";
import type { KnowledgeQualityAssessmentState } from "./knowledge-quality-assessment-state.js";
import type { KnowledgeQualityConfiguration } from "./knowledge-quality-configuration.js";
import type { KnowledgeQualityExecution } from "./knowledge-quality-execution.js";
import type { KnowledgeQualityFinding } from "./knowledge-quality-finding.js";
import type { KnowledgeQualityPolicy } from "./knowledge-quality-policy.js";
import type { KnowledgeQualityProfile } from "./knowledge-quality-profile.js";
import type { KnowledgeQualityReport } from "./knowledge-quality-report.js";
import type { KnowledgeQualityScoreMetadata } from "./knowledge-quality-score-metadata.js";

/**
 * "KnowledgeQualityAssessmentRecord" — the concrete, read-only view over one
 * Assessment's `KnowledgeQualityExecution`. Every operation that hands an Assessment
 * back to a caller returns one of these rather than the raw execution envelope. Named
 * distinctly from the `KnowledgeQuality` façade (`quality/knowledge-quality.ts`, the
 * "Public API" name) to avoid a same-name collision at the package barrel — matching
 * the `KnowledgeMarketplace`/`KnowledgeMarketplaceRecord` convention, and satisfying
 * the "KnowledgeQualityAssessment" Domain Model name via the raw instance type this
 * class wraps (`domain/knowledge-quality-assessment.ts`).
 */
export class KnowledgeQualityAssessmentRecord implements IKnowledgeQuality {
  constructor(private readonly execution: KnowledgeQualityExecution) {}

  get id(): string {
    return this.execution.instance.id;
  }

  get token(): string {
    return this.execution.instance.token;
  }

  get assessmentId(): string {
    return this.execution.instance.assessmentId;
  }

  get state(): KnowledgeQualityAssessmentState {
    return this.execution.instance.state;
  }

  get metadata(): KnowledgeQualityAssessmentMetadata {
    return this.execution.metadata;
  }

  get request(): KnowledgeQualityAssessmentRequest {
    return this.execution.request;
  }

  get context(): KnowledgeQualityContext {
    return this.execution.context;
  }

  get policy(): KnowledgeQualityPolicy | undefined {
    return this.execution.policy;
  }

  get profile(): KnowledgeQualityProfile | undefined {
    return this.execution.profile;
  }

  get configuration(): KnowledgeQualityConfiguration | undefined {
    return this.execution.configuration;
  }

  get findings(): readonly KnowledgeQualityFinding[] {
    return this.execution.findings;
  }

  get scoreMetadata(): readonly KnowledgeQualityScoreMetadata[] {
    return this.execution.scoreMetadata;
  }

  get report(): KnowledgeQualityReport | undefined {
    return this.execution.report;
  }

  get history(): readonly KnowledgeQualityAssessmentHistoryEntry[] {
    return this.execution.history;
  }

  get auditTrail(): readonly KnowledgeQualityAssessmentAudit[] {
    return this.execution.auditTrail;
  }

  get logs(): readonly KnowledgeQualityAssessmentLogEntry[] {
    return this.execution.logs;
  }

  toExecution(): KnowledgeQualityExecution {
    return this.execution;
  }
}
