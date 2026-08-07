import { KnowledgeMarketplaceException } from "./knowledge-marketplace-exception.js";

/** Thrown by the Pipeline's Validation stage when the 10-stage Validator reports failure. */
export class MarketplaceValidationException extends KnowledgeMarketplaceException {}
