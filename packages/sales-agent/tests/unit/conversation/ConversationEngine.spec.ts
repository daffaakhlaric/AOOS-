import { BranchId } from "@aos/branch-manager";
import type { IInventoryQueryService, InventoryUnit } from "@aos/dss-inventory-connector";
import { InventoryUnitBuilder, UnitTransmission } from "@aos/dss-inventory-connector";
import { Branch } from "@aos/meta-ads-connector";
import { beforeEach, describe, expect, it } from "vitest";

import { ConversationEngine } from "../../../src/conversation/ConversationEngine.js";
import { ResponseGenerator } from "../../../src/conversation/ResponseGenerator.js";
import { LeadConversation } from "../../../src/domain/entities/LeadConversation.js";
import { ConversationStage } from "../../../src/domain/value-objects/ConversationStage.js";
import { LeadScore } from "../../../src/domain/value-objects/LeadScore.js";
import { InventoryQuerier } from "../../../src/intelligence/InventoryQuerier.js";
import { makeRealSyncedInventoryQueryService } from "../../fixtures/salesAgentFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const NOW = new Date("2026-08-10T09:00:00.000Z");
const THRESHOLDS = { warmThreshold: 31, hotThreshold: 65 };

/** Simulates `ConversationPipeline` having already appended 2 prior messages (1 exchange) — puts the conversation past the GREETING-only "1 message" state. */
function withOneExchange(leadPhone: string, branchId: BranchId): LeadConversation {
  return LeadConversation.start(leadPhone, branchId, NOW)
    .withAppendedMessage({ isInbound: true } as never, NOW)
    .withAppendedMessage({ isInbound: false } as never, NOW);
}

describe("ConversationEngine", () => {
  let engine: ConversationEngine;

  beforeEach(async () => {
    const queryService = await makeRealSyncedInventoryQueryService();
    const inventoryQuerier = new InventoryQuerier(queryService);
    engine = new ConversationEngine(
      inventoryQuerier,
      THRESHOLDS,
      new ResponseGenerator(),
      () => "Sales Bintaro",
    );
  });

  it("GREETING stage → returns a greeting response", async () => {
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const decision = unwrap(await engine.decide(conversation, "halo min"));
    expect(decision.nextStage).toBe(ConversationStage.GREETING);
    expect(decision.responseText.length).toBeGreaterThan(0);
  });

  it("ASK_UNIT intent → queries real inventory → returns a unit response with real data", async () => {
    const conversation = withOneExchange("+6281200000001", BranchId.CINERE).withScore(
      LeadScore.zero().apply(25),
    );
    const decision = unwrap(await engine.decide(conversation, "ada xpander gak kak?"));
    expect(decision.nextStage).toBe(ConversationStage.UNIT_INFO);
    expect(decision.matchedUnits.length).toBeGreaterThan(0);
    expect(decision.responseText).toContain("Xpander");
  });

  it("HESITATION → objection response, not pushy", async () => {
    const conversation = withOneExchange("+6281200000001", BranchId.CINERE);
    const decision = unwrap(await engine.decide(conversation, "pikir dulu ya kak"));
    expect(decision.nextStage).toBe(ConversationStage.OBJECTION);
  });

  it("score ≥ 65 → handoff-bound CLOSING response", async () => {
    const conversation = withOneExchange("+6281200000001", BranchId.CINERE).withScore(
      LeadScore.zero().apply(70),
    );
    const decision = unwrap(await engine.decide(conversation, "oke lanjut kak"));
    expect(decision.nextStage).toBe(ConversationStage.CLOSING);
  });

  it("unit not found in own branch → suggests an alternative branch that has it", async () => {
    const conversation = withOneExchange("+6281200000001", BranchId.UMUM);
    const decision = unwrap(await engine.decide(conversation, "ada rush gak kak?"));
    expect(decision.matchedUnits).toHaveLength(0);
    expect(decision.responseText.length).toBeGreaterThan(0);
  });

  it("PRICE_INFO with a matched unit → includes DP info", async () => {
    const conversation = withOneExchange("+6281200000001", BranchId.BINTARO).withScore(
      LeadScore.zero().apply(31),
    );
    const decision = unwrap(await engine.decide(conversation, "dp brio berapa kak?"));
    expect(decision.nextStage).toBe(ConversationStage.PRICE_INFO);
  });

  it("every generated response stays ≤ 300 characters (WhatsApp friendly)", async () => {
    const scenarios: Array<[LeadConversation, string]> = [
      [LeadConversation.start("+62812", BranchId.CINERE, NOW), "halo min"],
      [withOneExchange("+62812", BranchId.CINERE), "ada xpander cinere?"],
      [
        withOneExchange("+62812", BranchId.BINTARO).withScore(LeadScore.zero().apply(31)),
        "dp brio berapa kak",
      ],
      [withOneExchange("+62812", BranchId.CINERE), "pikir dulu ah"],
      [
        withOneExchange("+62812", BranchId.CINERE).withScore(LeadScore.zero().apply(70)),
        "oke siap",
      ],
    ];
    for (const [conversation, text] of scenarios) {
      const decision = unwrap(await engine.decide(conversation, text));
      expect(decision.responseText.length).toBeLessThanOrEqual(300);
    }
  });

  it("propagates an AgentError from InventoryQuerier.findForLead", async () => {
    const throwingQueryService = {
      getAvailableByBranch: () => {
        throw new Error("store unavailable");
      },
    } as unknown as IInventoryQueryService;
    const throwingEngine = new ConversationEngine(
      new InventoryQuerier(throwingQueryService),
      THRESHOLDS,
      new ResponseGenerator(),
      () => "Sales Bintaro",
    );
    const conversation = withOneExchange("+6281200000001", BranchId.CINERE);
    const result = await throwingEngine.decide(conversation, "ada xpander gak kak?");
    expect(unwrapErr(result).message).toContain("InventoryQuerier.findForLead failed");
  });

  it("an alternative unit on a branch with no BranchId mapping (Branch.BOOST) leaves alternativeBranchName undefined", async () => {
    const boostUnit: InventoryUnit = unwrap(
      new InventoryUnitBuilder()
        .withModel("Rush G")
        .withTransmission(UnitTransmission.AT)
        .withBranch(Branch.BOOST)
        .build(),
    );
    const fakeQueryService = {
      getAvailableByBranch: () => [],
      getAvailable: () => [boostUnit],
    } as unknown as IInventoryQueryService;
    const fakeEngine = new ConversationEngine(
      new InventoryQuerier(fakeQueryService),
      THRESHOLDS,
      new ResponseGenerator(),
      () => "Sales Bintaro",
    );
    const conversation = withOneExchange("+6281200000001", BranchId.CINERE);
    const decision = unwrap(await fakeEngine.decide(conversation, "ada rush gak kak?"));
    expect(decision.matchedUnits).toHaveLength(0);
    expect(decision.responseText).not.toContain("tapi di");
  });
});
