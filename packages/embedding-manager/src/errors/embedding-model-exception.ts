import { EmbeddingManagerException } from "./embedding-manager-exception.js";

/** Thrown when a Model reference cannot be resolved or is incompatible with its declared Provider. */
export class EmbeddingModelException extends EmbeddingManagerException {}
