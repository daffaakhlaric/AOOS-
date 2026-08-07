/**
 * "REGISTRY: Buckets: Assessment Registry, Session Registry, Finding Registry, Rule
 * Registry, Profile Registry, Statistics Registry, Audit Registry, Configuration
 * Registry." (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md) — the exact 8 buckets from the
 * prompt. Notably JOB and POLICY are NOT Registry buckets in this package (unlike
 * `@aos/knowledge-generator`'s JOB bucket) — Jobs are tracked via a dedicated ledger on
 * `KnowledgeQualityManager` and Policies via a dedicated map on `KnowledgeQualityResolver`,
 * since the spec enumerates exactly these 8 names. See docs/005.7L-KNOWLEDGE-QUALITY-
 * ENGINE-REPORT.md — "Registry" for the full judgment call.
 */
export enum KnowledgeQualityRegistryBucket {
  ASSESSMENT = "assessment",
  SESSION = "session",
  FINDING = "finding",
  RULE = "rule",
  PROFILE = "profile",
  STATISTICS = "statistics",
  AUDIT = "audit",
  CONFIGURATION = "configuration",
}
