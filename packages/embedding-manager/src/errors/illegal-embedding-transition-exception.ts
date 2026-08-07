import { EmbeddingManagerException } from "./embedding-manager-exception.js";

/** Thrown when the State Machine is asked to move an `Embedding` across an edge not present in the transition table. */
export class IllegalEmbeddingTransitionException extends EmbeddingManagerException {}
