import { KnowledgeGeneratorException } from "./knowledge-generator-exception.js";

/** Thrown by `KnowledgeGeneratorStateMachine.transition()` when the requested edge is not in `KNOWLEDGE_GENERATION_STATE_TRANSITIONS`. */
export class IllegalGenerationTransitionException extends KnowledgeGeneratorException {}
