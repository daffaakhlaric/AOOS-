import { KnowledgeQualityException } from "./knowledge-quality-exception.js";

/** Thrown when a Finding Operation (`recordFinding()`) is attempted against an Assessment that is not in a state that can accept Findings. */
export class QualityFindingException extends KnowledgeQualityException {}
