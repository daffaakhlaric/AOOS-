import { EmbeddingManagerException } from "./embedding-manager-exception.js";

/** Thrown by the 12-stage Validator when a stage's checks fail and the caller requested strict enforcement. */
export class EmbeddingCheckException extends EmbeddingManagerException {}
