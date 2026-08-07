/**
 * "KNOWLEDGE TYPES: Support metadata for generating SOP, FAQ, Product Knowledge, Sales
 * Script, Marketing Content, HR Policy, Job Description, Documentation, API
 * Documentation, Technical Specification, Business Process, Workflow Documentation,
 * User Guide, Knowledge Base Article, Meeting Summary, Research Summary, Proposal,
 * Contract Template, Email Template, Custom Knowledge. Metadata only."
 * (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md) — the exact 20 Knowledge Types, labels
 * only, attached to a `KnowledgeGenerationRequest`. This package never generates any of
 * them — the enum exists purely to classify what kind of asset a caller-supplied
 * `IKnowledgeGenerationProvider` is being asked to produce.
 */
export enum KnowledgeGenerationAssetType {
  SOP = "sop",
  FAQ = "faq",
  PRODUCT_KNOWLEDGE = "product_knowledge",
  SALES_SCRIPT = "sales_script",
  MARKETING_CONTENT = "marketing_content",
  HR_POLICY = "hr_policy",
  JOB_DESCRIPTION = "job_description",
  DOCUMENTATION = "documentation",
  API_DOCUMENTATION = "api_documentation",
  TECHNICAL_SPECIFICATION = "technical_specification",
  BUSINESS_PROCESS = "business_process",
  WORKFLOW_DOCUMENTATION = "workflow_documentation",
  USER_GUIDE = "user_guide",
  KNOWLEDGE_BASE_ARTICLE = "knowledge_base_article",
  MEETING_SUMMARY = "meeting_summary",
  RESEARCH_SUMMARY = "research_summary",
  PROPOSAL = "proposal",
  CONTRACT_TEMPLATE = "contract_template",
  EMAIL_TEMPLATE = "email_template",
  CUSTOM_KNOWLEDGE = "custom_knowledge",
}
