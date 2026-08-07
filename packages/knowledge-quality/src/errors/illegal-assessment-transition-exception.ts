import { KnowledgeQualityException } from "./knowledge-quality-exception.js";

/** Thrown by `KnowledgeQualityStateMachine.transition()` when the requested edge is not in `KNOWLEDGE_QUALITY_ASSESSMENT_STATE_TRANSITIONS`. */
export class IllegalAssessmentTransitionException extends KnowledgeQualityException {}
