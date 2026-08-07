import { EmbeddingManagerException } from "./embedding-manager-exception.js";

/** Thrown when a Registry `register()` call collides with an existing id in the same bucket. */
export class DuplicateEmbeddingEntryException extends EmbeddingManagerException {}
