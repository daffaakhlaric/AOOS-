import { BranchId } from "@aos/branch-manager";
import { beforeEach, describe, expect, it } from "vitest";

import { ConversationEngine } from "../../../src/conversation/ConversationEngine.js";
import { ResponseGenerator } from "../../../src/conversation/ResponseGenerator.js";
import { LeadConversation } from "../../../src/domain/entities/LeadConversation.js";
import { LeadProfile } from "../../../src/domain/entities/LeadProfile.js";
import { ConversationStage } from "../../../src/domain/value-objects/ConversationStage.js";
import { LeadScore } from "../../../src/domain/value-objects/LeadScore.js";
import { QualificationStatus } from "../../../src/domain/value-objects/QualificationStatus.js";
import { InventoryQuerier } from "../../../src/intelligence/InventoryQuerier.js";
import {
  ASK_AREA_POOL,
  ASK_BUDGET_POOL,
  ASK_PAYMENT_POOL,
  ASK_UNIT_POOL,
} from "../../../src/responses/QualificationResponses.js";
import { makeRealSyncedInventoryQueryService } from "../../fixtures/salesAgentFixtures.js";
import { unwrap } from "../../helpers/result.js";

const NOW = new Date("2026-08-10T09:00:00.000Z");
const THRESHOLDS = { warmThreshold: 31, hotThreshold: 65 };

/** score=40 (WARM), turn=2 (below the CLOSING min-turn gate of 4) → falls through to QUALIFICATION. */
function qualificationConversation(profile: LeadProfile = LeadProfile.empty()): LeadConversation {
  return LeadConversation.start("+6281200000001", BranchId.CINERE, NOW)
    .withAppendedMessage({ isInbound: true } as never, NOW)
    .withAppendedMessage({ isInbound: false } as never, NOW)
    .withScore(LeadScore.zero().apply(40))
    .withProfile(profile);
}

describe("ConversationEngine — active qualification asking (AAOS-W3D Fix 3)", () => {
  let engine: ConversationEngine;

  beforeEach(async () => {
    const queryService = await makeRealSyncedInventoryQueryService();
    const inventoryQuerier = new InventoryQuerier(queryService);
    engine = new ConversationEngine(
      inventoryQuerier,
      THRESHOLDS,
      new ResponseGenerator(),
      () => "Sales Cinere",
    );
  });

  it("nothing extracted yet → QUALIFICATION stage asks about BUDGET", async () => {
    const conversation = qualificationConversation();
    const decision = unwrap(await engine.decide(conversation, "oke kak"));
    expect(decision.nextStage).toBe(ConversationStage.QUALIFICATION);
    expect(ASK_BUDGET_POOL).toContain(decision.responseText);
  });

  it("BUDGET already extracted → asks about UNIT next", async () => {
    const profile = LeadProfile.empty().withEnrichment(
      { budget: "200 juta" },
      QualificationStatus.BUDGET,
    );
    const conversation = qualificationConversation(profile);
    const decision = unwrap(await engine.decide(conversation, "oke kak"));
    expect(ASK_UNIT_POOL).toContain(decision.responseText);
  });

  it("BUDGET + UNIT extracted → asks about AREA next", async () => {
    const profile = LeadProfile.empty()
      .withEnrichment({ budget: "200 juta" }, QualificationStatus.BUDGET)
      .withEnrichment({ unit: "Xpander" }, QualificationStatus.UNIT);
    const conversation = qualificationConversation(profile);
    const decision = unwrap(await engine.decide(conversation, "oke kak"));
    expect(ASK_AREA_POOL).toContain(decision.responseText);
  });

  it("BUDGET + UNIT + AREA extracted → asks about PAYMENT next", async () => {
    const profile = LeadProfile.empty()
      .withEnrichment({ budget: "200 juta" }, QualificationStatus.BUDGET)
      .withEnrichment({ unit: "Xpander" }, QualificationStatus.UNIT)
      .withEnrichment({ area: "Cinere" }, QualificationStatus.AREA);
    const conversation = qualificationConversation(profile);
    const decision = unwrap(await engine.decide(conversation, "oke kak"));
    expect(ASK_PAYMENT_POOL).toContain(decision.responseText);
  });

  it("all 4 core criteria extracted → falls back to the generic budget-follow-up pool (unchanged legacy behavior)", async () => {
    const profile = LeadProfile.empty()
      .withEnrichment({ budget: "200 juta" }, QualificationStatus.BUDGET)
      .withEnrichment({ unit: "Xpander" }, QualificationStatus.UNIT)
      .withEnrichment({ area: "Cinere" }, QualificationStatus.AREA)
      .withEnrichment({ paymentMethod: "Cash" }, QualificationStatus.PAYMENT);
    const conversation = qualificationConversation(profile);
    const decision = unwrap(await engine.decide(conversation, "oke kak"));
    expect(ASK_BUDGET_POOL).not.toContain(decision.responseText);
    expect(ASK_UNIT_POOL).not.toContain(decision.responseText);
    expect(ASK_AREA_POOL).not.toContain(decision.responseText);
    expect(ASK_PAYMENT_POOL).not.toContain(decision.responseText);
    expect(decision.responseText.length).toBeGreaterThan(0);
  });

  it("every active qualification ask stays ≤ 150 chars", async () => {
    const conversation = qualificationConversation();
    const decision = unwrap(await engine.decide(conversation, "oke kak"));
    expect(decision.responseText.length).toBeLessThanOrEqual(150);
  });
});
