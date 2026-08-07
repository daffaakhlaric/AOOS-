import { KnowledgeQualityException } from "./knowledge-quality-exception.js";

/** Thrown by the Pipeline's Policy Resolution stage (Stage 4) when a resolved `KnowledgeQualityPolicy` denies the request. */
export class QualityPolicyException extends KnowledgeQualityException {}
