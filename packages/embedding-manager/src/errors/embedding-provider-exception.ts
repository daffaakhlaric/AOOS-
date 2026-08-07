import { EmbeddingManagerException } from "./embedding-manager-exception.js";

/** Thrown when a Provider reference cannot be resolved, is inactive, or fails a cross-check against a Model. */
export class EmbeddingProviderException extends EmbeddingManagerException {}
