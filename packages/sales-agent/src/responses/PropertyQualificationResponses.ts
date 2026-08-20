import type { LeadConversation } from "../domain/entities/LeadConversation.js";
import {
  PROPERTY_SCORING_RULES,
  type PropertyScoringRule,
} from "../scoring/PropertyScoreCalculator.js";

/**
 * The next `PropertyScoringRule` (of `PropertyScoreCalculator`'s real 6 PROPERTY dimensions —
 * budget/type/area/payment/timeline/bedrooms) Jessy should actively ask about, or `undefined` if
 * every dimension has already been mentioned somewhere in the lead's own message history. Unlike
 * automotive's `nextCriterionToAsk` (which reads `LeadConversation.profile`/`askedCriteria` —
 * `QualificationStatus`-typed state this phase deliberately does NOT extend, per the coordinator
 * note's scoped-down point 1), this is a pure function of the conversation's own inbound message
 * text: each rule's own `detect` predicate is checked against every inbound message joined together,
 * so a dimension mentioned on an earlier turn is never re-asked.
 */
export function nextPropertyCriterionToAsk(
  conversation: LeadConversation,
): PropertyScoringRule | undefined {
  const combinedText = conversation.messages
    .filter((message) => message.isInbound)
    .map((message) => message.text)
    .join(" ");
  return PROPERTY_SCORING_RULES.find((rule) => !rule.detect(combinedText));
}
