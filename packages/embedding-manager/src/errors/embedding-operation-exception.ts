import { EmbeddingManagerException } from "./embedding-manager-exception.js";

/** Thrown when an Embedding Operation is invoked in a way that violates a documented precondition. */
export class EmbeddingOperationException extends EmbeddingManagerException {}
