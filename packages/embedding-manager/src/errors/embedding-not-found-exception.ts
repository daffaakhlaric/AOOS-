import { EmbeddingManagerException } from "./embedding-manager-exception.js";

/** Thrown when a Registry `require()`/Manager lookup finds no entry for the given id/token. */
export class EmbeddingNotFoundException extends EmbeddingManagerException {}
