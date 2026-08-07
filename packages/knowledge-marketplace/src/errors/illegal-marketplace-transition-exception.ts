import { KnowledgeMarketplaceException } from "./knowledge-marketplace-exception.js";

/** Thrown when the State Machine is asked to perform a transition the FSM table forbids. */
export class IllegalMarketplaceTransitionException extends KnowledgeMarketplaceException {}
