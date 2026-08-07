/**
 * "VALIDATION CATEGORIES: Support metadata for Policy Validation, Structure Validation,
 * Metadata Validation, Reference Validation, Compliance Validation, Security
 * Validation, Business Validation, Quality Validation, Custom Validation."
 * (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md) — the exact 9 Validation Categories,
 * labels only, attached to `KnowledgeValidationRequest`/`KnowledgeValidationRule`/
 * `KnowledgeValidationFinding`. This package never decides which Category applies to a
 * given piece of knowledge — the enum exists purely to classify what a caller-supplied
 * `IKnowledgeValidationProvider`/`IKnowledgeValidationRuleProvider` reported.
 */
export enum KnowledgeValidationCategory {
  POLICY_VALIDATION = "policy_validation",
  STRUCTURE_VALIDATION = "structure_validation",
  METADATA_VALIDATION = "metadata_validation",
  REFERENCE_VALIDATION = "reference_validation",
  COMPLIANCE_VALIDATION = "compliance_validation",
  SECURITY_VALIDATION = "security_validation",
  BUSINESS_VALIDATION = "business_validation",
  QUALITY_VALIDATION = "quality_validation",
  CUSTOM_VALIDATION = "custom_validation",
}
