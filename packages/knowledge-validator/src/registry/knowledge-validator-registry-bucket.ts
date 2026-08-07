/**
 * "REGISTRY: Buckets — Validation Registry, Session Registry, Rule Registry, Decision
 * Registry, Configuration Registry, Statistics Registry, Audit Registry, Finding
 * Registry." (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md) — the exact 8 buckets from the
 * prompt. Notably JOB and POLICY are NOT Registry buckets in this package — Jobs are
 * tracked via a dedicated ledger on `KnowledgeValidatorManager` and Policies via a
 * dedicated map on `KnowledgeValidatorResolver`, since the spec enumerates exactly
 * these 8 names, matching the `@aos/knowledge-quality` precedent. See
 * docs/005.7M-KNOWLEDGE-VALIDATOR-AI-REPORT.md — "Registry" for the full judgment call.
 */
export enum KnowledgeValidatorRegistryBucket {
  VALIDATION = "validation",
  SESSION = "session",
  RULE = "rule",
  DECISION = "decision",
  CONFIGURATION = "configuration",
  STATISTICS = "statistics",
  AUDIT = "audit",
  FINDING = "finding",
}
