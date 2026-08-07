import { EmbeddingManagerException } from "./embedding-manager-exception.js";

/** Thrown when a domain record fails its Zod schema or an explicit invariant check. */
export class InvalidEmbeddingMetadataException extends EmbeddingManagerException {}
