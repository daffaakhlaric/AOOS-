import type {
  IPropertyResponseGenerator,
  PropertyResponseContext,
} from "../contracts/IPropertyResponseGenerator.js";
import { ConversationStage } from "../domain/value-objects/ConversationStage.js";
import { nextPropertyCriterionToAsk } from "../responses/PropertyQualificationResponses.js";
import {
  getKprInfoResponse,
  getListingFoundResponse,
  getListingNotFoundResponse,
  getPropertyClosedResponse,
  getPropertyClosingResponse,
  getPropertyColdNurtureResponse,
  getPropertyDiscoveryQuestion,
  getPropertyGenericFollowUp,
  getPropertyGreeting,
  getPropertyHandoffResponse,
  getPropertyObjectionResponse,
  getPropertySyariahResponse,
} from "../responses/PropertyResponses.js";

import { PropertyDetectedIntent } from "./PropertyIntentDetector.js";

const DEFAULT_SALES_NAME = "tim sales kita";
const DEFAULT_HOT_THRESHOLD = 65;
const SOFT_LENGTH_TARGET = 150;
const HARD_LENGTH_CEILING = 200;

const SYARIAH_ELIGIBLE_STAGES: ReadonlySet<ConversationStage> = new Set([
  ConversationStage.GREETING,
  ConversationStage.DISCOVERY,
  ConversationStage.QUALIFICATION,
  ConversationStage.UNIT_INFO,
  ConversationStage.PRICE_INFO,
  ConversationStage.OBJECTION,
]);

/**
 * Generates Jessy's reply text for the current PROPERTY-vertical stage/context — the sibling to
 * `ResponseGenerator` (spec section 11 point 1). Same deterministic-seed discipline (always
 * `conversation.inboundMessageCount`, never `Math.random()`) and same length backstop.
 */
export class PropertyResponseGenerator implements IPropertyResponseGenerator {
  generate(context: PropertyResponseContext): Promise<string> {
    return Promise.resolve(this.validateLength(this.rawResponse(context)));
  }

  private rawResponse(context: PropertyResponseContext): string {
    const seed = context.conversation.inboundMessageCount;

    if (
      context.intents.includes(PropertyDetectedIntent.SYARIAH) &&
      SYARIAH_ELIGIBLE_STAGES.has(context.stage)
    ) {
      return getPropertySyariahResponse(seed);
    }

    switch (context.stage) {
      case ConversationStage.GREETING:
        return getPropertyGreeting(seed);

      case ConversationStage.DISCOVERY:
        return getPropertyDiscoveryQuestion(seed);

      case ConversationStage.QUALIFICATION:
        return this.qualificationResponse(context, seed);

      case ConversationStage.UNIT_INFO:
        return this.listingInfoResponse(context);

      case ConversationStage.PRICE_INFO:
        return this.priceInfoResponse(context, seed);

      case ConversationStage.OBJECTION:
        return getPropertyObjectionResponse(context.messageText, seed, context.intents);

      case ConversationStage.CLOSING:
        return getPropertyClosingResponse(
          context.conversation.score.toNumber(),
          context.conversation.closingAttemptCount,
          context.hotThreshold ?? DEFAULT_HOT_THRESHOLD,
          seed,
        );

      case ConversationStage.HANDOFF:
        return getPropertyHandoffResponse(context.salesName ?? DEFAULT_SALES_NAME, seed);

      case ConversationStage.NURTURE:
        return getPropertyColdNurtureResponse(seed);

      case ConversationStage.CLOSED:
        return getPropertyClosedResponse(seed);
    }
  }

  /** Asks for the next PROPERTY dimension not yet mentioned (`nextPropertyCriterionToAsk`, driven by `PropertyScoreCalculator`'s own real question copy); once every dimension has been mentioned, falls back to a generic follow-up. */
  private qualificationResponse(context: PropertyResponseContext, seed: number): string {
    const rule = nextPropertyCriterionToAsk(context.conversation);
    if (rule !== undefined) {
      return rule.question;
    }
    return getPropertyGenericFollowUp(seed);
  }

  private validateLength(response: string): string {
    if (response.length <= HARD_LENGTH_CEILING) {
      return response;
    }
    return this.trimToSentence(response, SOFT_LENGTH_TARGET);
  }

  private trimToSentence(text: string, maxLength: number): string {
    const truncated = text.slice(0, maxLength);
    const lastBoundary = Math.max(
      truncated.lastIndexOf("."),
      truncated.lastIndexOf("!"),
      truncated.lastIndexOf("?"),
      truncated.lastIndexOf("\n"),
    );
    return lastBoundary > 0 ? text.slice(0, lastBoundary + 1) : truncated;
  }

  private listingInfoResponse(context: PropertyResponseContext): string {
    const seed = context.conversation.inboundMessageCount;
    const firstMatch = context.matchedListings[0];
    if (firstMatch !== undefined) {
      return getListingFoundResponse(firstMatch, seed);
    }
    return getListingNotFoundResponse(
      context.requestedPropertyType ?? "properti itu",
      context.alternativeCity,
    );
  }

  private priceInfoResponse(context: PropertyResponseContext, seed: number): string {
    const firstMatch = context.matchedListings[0];
    if (firstMatch !== undefined) {
      return getKprInfoResponse(firstMatch, seed);
    }
    return "Properti yang mana nih kak yang mau dihitung DP/KPR-nya? Biar Jessy bantu hitungin 😊";
  }
}
