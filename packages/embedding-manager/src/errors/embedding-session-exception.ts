import { EmbeddingManagerException } from "./embedding-manager-exception.js";

/** Thrown by `EmbeddingSession` on illegal session-lifecycle operations (double-open, close-when-not-open, etc). */
export class EmbeddingSessionException extends EmbeddingManagerException {}
