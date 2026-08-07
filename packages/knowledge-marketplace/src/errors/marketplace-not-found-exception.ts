import { KnowledgeMarketplaceException } from "./knowledge-marketplace-exception.js";

/** Thrown when a Registry `require()`/Manager lookup finds no entry for the given id/token. */
export class MarketplaceNotFoundException extends KnowledgeMarketplaceException {}
