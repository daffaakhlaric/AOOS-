import { EmbeddingManagerException } from "./embedding-manager-exception.js";

/** Thrown when an `EmbeddingVersion` reference cannot be resolved or is invalid for its Model/Provider pair. */
export class EmbeddingVersionException extends EmbeddingManagerException {}
