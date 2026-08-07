import { KnowledgeQualityException } from "./knowledge-quality-exception.js";

/** Thrown by the Pipeline's Rule Resolution stage (Stage 2) when a declared Rule id does not resolve against the Rule Registry bucket. */
export class QualityRuleException extends KnowledgeQualityException {}
