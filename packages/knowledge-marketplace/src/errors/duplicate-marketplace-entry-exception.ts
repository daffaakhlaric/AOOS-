import { KnowledgeMarketplaceException } from "./knowledge-marketplace-exception.js";

/** Thrown when a Registry `register()` call targets an id already present in the bucket. */
export class DuplicateMarketplaceEntryException extends KnowledgeMarketplaceException {}
