import { EmbeddingManagerException } from "./embedding-manager-exception.js";

/** Thrown when an `EmbeddingConfiguration` record is malformed or references an unknown target. */
export class EmbeddingConfigurationException extends EmbeddingManagerException {}
