import { KnowledgeMarketplaceException } from "./knowledge-marketplace-exception.js";

/** Thrown when `KnowledgeMarketplaceSession.renew()` is called on a Session that already expired. */
export class MarketplaceLeaseException extends KnowledgeMarketplaceException {}
