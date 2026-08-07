import { KnowledgeMarketplaceException } from "./knowledge-marketplace-exception.js";

/** Thrown when a Marketplace Operation cannot proceed for a reason not covered by a more specific exception. */
export class MarketplaceOperationException extends KnowledgeMarketplaceException {}
