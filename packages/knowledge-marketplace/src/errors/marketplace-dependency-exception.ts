import { KnowledgeMarketplaceException } from "./knowledge-marketplace-exception.js";

/** Thrown when a declared Dependency cannot be resolved against the Dependency Registry. */
export class MarketplaceDependencyException extends KnowledgeMarketplaceException {}
