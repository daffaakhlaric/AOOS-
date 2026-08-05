/** "POLICY ENGINE" (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md) — the 10 policy kinds `KnowledgePolicyEngine` evaluates. */
export enum KnowledgePolicyType {
  RETENTION = "retention",
  PUBLISHING = "publishing",
  CLASSIFICATION = "classification",
  ACCESS = "access",
  SHARING = "sharing",
  COMPLIANCE = "compliance",
  VALIDATION = "validation",
  REVIEW = "review",
  APPROVAL = "approval",
  SYNCHRONIZATION = "synchronization",
}
