import type { LeadConversation } from "../domain/entities/LeadConversation.js";
import { ConversationStage } from "../domain/value-objects/ConversationStage.js";

import { PropertyDetectedIntent } from "./PropertyIntentDetector.js";
import type { StageDetectorThresholds } from "./StageDetector.js";

const WARM_CLOSING_MIN_TURN = 4;

function canAttemptClosing(conversation: LeadConversation): boolean {
  if (conversation.closingAttemptCount < 2) {
    return true;
  }
  return conversation.score.toNumber() > conversation.scoreAtLastClosingAttempt;
}

/**
 * Detects the conversation stage to move INTO for the current turn — the PROPERTY-vertical sibling
 * to `StageDetector` (spec section 11 point 1). `StageDetector`'s own algorithm has no automotive
 * coupling (it only reads generic `LeadConversation` score/message-count state), so this is
 * deliberately the SAME priority order/logic, just typed against `PropertyDetectedIntent` (whose
 * `ASK_LISTING`/`ASK_AREA` members replace automotive's `ASK_UNIT`/`ASK_LOCATION`) so
 * `PropertyConversationEngine` can pass PROPERTY-specific thresholds
 * (`PROPERTY_WARM_THRESHOLD`/`PROPERTY_HOT_THRESHOLD`) and intents without reaching into the
 * automotive `DetectedIntent` enum. Kept as a real, independent sibling (not a generic-intent
 * reuse of `StageDetector`) so this vertical's stage logic can diverge safely in the future without
 * risking a silent regression to DSS Motor's automotive behaviour.
 */
export class PropertyStageDetector {
  static detect(
    conversation: LeadConversation,
    intents: ReadonlyArray<PropertyDetectedIntent>,
    thresholds: StageDetectorThresholds,
  ): ConversationStage {
    const score = conversation.score.toNumber();

    if (score >= thresholds.hotThreshold) {
      return ConversationStage.CLOSING;
    }

    if (intents.includes(PropertyDetectedIntent.ASK_PRICE)) {
      return ConversationStage.PRICE_INFO;
    }

    if (intents.includes(PropertyDetectedIntent.ASK_LISTING)) {
      return ConversationStage.UNIT_INFO;
    }

    if (
      intents.includes(PropertyDetectedIntent.HESITATION) ||
      intents.includes(PropertyDetectedIntent.COMPLAINT)
    ) {
      return ConversationStage.OBJECTION;
    }

    if (conversation.messages.length <= 1) {
      return ConversationStage.GREETING;
    }

    if (score < thresholds.warmThreshold && conversation.inboundMessageCount < 3) {
      return ConversationStage.DISCOVERY;
    }

    if (
      score >= thresholds.warmThreshold &&
      conversation.inboundMessageCount >= WARM_CLOSING_MIN_TURN &&
      canAttemptClosing(conversation)
    ) {
      return ConversationStage.CLOSING;
    }

    return ConversationStage.QUALIFICATION;
  }
}
