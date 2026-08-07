import { KnowledgeMarketplaceException } from "./knowledge-marketplace-exception.js";

/** Thrown when a `Custom`-typed Category is declared without a matching registered `MarketplaceCategory` record. */
export class MarketplaceCategoryException extends KnowledgeMarketplaceException {}
