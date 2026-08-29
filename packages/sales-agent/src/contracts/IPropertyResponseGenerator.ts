import type { PropertyDetectedIntent } from "../conversation/PropertyIntentDetector.js";
import type { LeadConversation } from "../domain/entities/LeadConversation.js";
import type { PropertyListing, PropertyType } from "../domain/entities/PropertyListing.js";
import type { ConversationStage } from "../domain/value-objects/ConversationStage.js";

export interface PropertyResponseContext {
  readonly conversation: LeadConversation;
  readonly stage: ConversationStage;
  readonly intents: ReadonlyArray<PropertyDetectedIntent>;
  readonly messageText: string;
  readonly matchedListings: ReadonlyArray<PropertyListing>;
  /** The property type the lead asked about, if `UNIT_INFO`/`PRICE_INFO` and no match was found. */
  readonly requestedPropertyType?: PropertyType;
  /** A different city that DOES have a match, if the lead's own stated area came up empty. */
  readonly alternativeCity?: string;
  readonly salesName?: string;
  /** The configured HOT threshold — see `IResponseGenerator.ResponseContext.hotThreshold`. Optional for the same reason (pre-existing hand-built test contexts keep compiling); real callers always set it from the real configured PROPERTY thresholds. */
  readonly hotThreshold?: number;
}

/**
 * Port: generates Clara's natural-Indonesian reply text for a given PROPERTY-vertical stage/intent/
 * context — the sibling to `IResponseGenerator`. Always <= 300 chars.
 */
export interface IPropertyResponseGenerator {
  generate(context: PropertyResponseContext): Promise<string>;
}
