import { ok, type Result } from "@aos/common";

import type {
  IPropertyConversationEngine,
  PropertyEngineDecision,
} from "../contracts/IPropertyConversationEngine.js";
import type { LeadConversation } from "../domain/entities/LeadConversation.js";
import type { PropertyListing, PropertyType } from "../domain/entities/PropertyListing.js";
import type { AgentError } from "../domain/errors/AgentError.js";
import { ConversationStage } from "../domain/value-objects/ConversationStage.js";
import type { ListingQuerier } from "../intelligence/ListingQuerier.js";

import { PropertyIntentDetector } from "./PropertyIntentDetector.js";
import type { PropertyResponseGenerator } from "./PropertyResponseGenerator.js";
import { PropertyStageDetector } from "./PropertyStageDetector.js";
import type { StageDetectorThresholds } from "./StageDetector.js";

const PROPERTY_TYPE_KEYWORDS: ReadonlyArray<[RegExp, PropertyType]> = [
  [/apartemen|apart/i, "APARTEMEN"],
  [/ruko/i, "RUKO"],
  [/tanah|kavling/i, "TANAH"],
  [/villa/i, "VILLA"],
  [/rumah/i, "RUMAH"],
];

function extractPropertyType(messageText: string): PropertyType | undefined {
  const found = PROPERTY_TYPE_KEYWORDS.find(([pattern]) => pattern.test(messageText));
  return found?.[1];
}

const BUDGET_AMOUNT_PATTERN = /(\d+(?:[.,]\d+)?)\s*(juta|jt|miliar|m\b)/i;

function extractMaxPriceIDR(messageText: string): number | undefined {
  const match = BUDGET_AMOUNT_PATTERN.exec(messageText);
  if (match === null) {
    return undefined;
  }
  const amount = Number.parseFloat(match[1]!.replace(",", "."));
  /* v8 ignore start -- unreachable: `BUDGET_AMOUNT_PATTERN`'s capture group only ever matches
     digits with an optional single `.`/`,` separator, so `parseFloat` always succeeds here
     (mirrors `ConversationEngine.ts`'s automotive `extractMaxPriceIDR`). */
  if (!Number.isFinite(amount)) {
    return undefined;
  }
  /* v8 ignore stop */
  const unit = match[2]!.toLowerCase();
  const multiplier = unit === "juta" || unit === "jt" ? 1_000_000 : 1_000_000_000;
  return Math.round(amount * multiplier);
}

const BEDROOMS_PATTERN = /(\d+)\s*(?:kamar|kt|bed\s*room)|kamar\s*(\d+)/i;

function extractMinBedrooms(messageText: string): number | undefined {
  const match = BEDROOMS_PATTERN.exec(messageText);
  if (match === null) {
    return undefined;
  }
  // `BEDROOMS_PATTERN`'s two alternatives each carry their own capture group and only ever
  // capture digits, so a non-null match always yields a valid `match[1]`/`match[2]` integer.
  const captured = (match[1] ?? match[2])!;
  return Number.parseInt(captured, 10);
}

const CITY_KEYWORDS: ReadonlyArray<string> = [
  "bintaro",
  "cinere",
  "jakarta",
  "bandung",
  "surabaya",
  "tangerang",
  "depok",
  "bekasi",
];

/** Extracts a known city name mentioned in the message (spec section 11 point 1's real "gak ada di area itu, tapi ada yang mirip di [kota] lain" alternative-city flow — mirrors `PropertyScoreCalculator`'s own `AREA_PATTERN` vocabulary). */
function extractCity(messageText: string): string | undefined {
  const lower = messageText.toLowerCase();
  return CITY_KEYWORDS.find((city) => lower.includes(city));
}

const LISTING_QUESTION_STAGES: ReadonlySet<ConversationStage> = new Set([
  ConversationStage.UNIT_INFO,
  ConversationStage.PRICE_INFO,
]);

/**
 * Decides what Jessy says next for a PROPERTY-vertical conversation — the sibling to
 * `ConversationEngine` (spec section 11 point 1). Runs `PropertyIntentDetector` +
 * `PropertyStageDetector`, queries Phase 2's real `listings` via `ListingQuerier` when the stage is
 * `UNIT_INFO`/`PRICE_INFO`, then delegates to `PropertyResponseGenerator` for the final text.
 */
export class PropertyConversationEngine implements IPropertyConversationEngine {
  constructor(
    private readonly listingQuerier: ListingQuerier,
    private readonly thresholds: StageDetectorThresholds,
    private readonly responseGenerator: PropertyResponseGenerator,
    private readonly resolveSalesName: (branchId: LeadConversation["branchId"]) => string,
  ) {}

  async decide(
    conversation: LeadConversation,
    messageText: string,
  ): Promise<Result<PropertyEngineDecision, AgentError>> {
    const intents = PropertyIntentDetector.detect(messageText);
    const stage = PropertyStageDetector.detect(conversation, intents, this.thresholds);

    let matchedListings: PropertyListing[] = [];
    let requestedPropertyType: PropertyType | undefined;
    let alternativeCity: string | undefined;

    if (LISTING_QUESTION_STAGES.has(stage)) {
      requestedPropertyType = extractPropertyType(messageText);
      const maxPrice = extractMaxPriceIDR(messageText);
      const minBedrooms = extractMinBedrooms(messageText);
      const city = extractCity(messageText);
      const result = await this.listingQuerier.findForLead({
        propertyType: requestedPropertyType,
        maxPrice,
        minBedrooms,
        city,
      });
      if (!result.ok) {
        return result;
      }
      matchedListings = result.value;

      if (matchedListings.length === 0 && requestedPropertyType !== undefined) {
        const alternative = this.listingQuerier.findAlternative({
          propertyType: requestedPropertyType,
          maxPrice,
          minBedrooms,
        });
        alternativeCity = alternative[0]?.city;
      }
    }

    const responseText = await this.responseGenerator.generate({
      conversation,
      stage,
      intents,
      messageText,
      matchedListings,
      requestedPropertyType,
      alternativeCity,
      salesName: this.resolveSalesName(conversation.branchId),
      hotThreshold: this.thresholds.hotThreshold,
    });

    return ok({ nextStage: stage, responseText, matchedListings });
  }
}
