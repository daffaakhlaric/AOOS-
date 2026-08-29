import { BranchId } from "@aos/branch-manager";
import { InventoryUnitBuilder, UnitTransmission } from "@aos/dss-inventory-connector";
import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import type { ResponseContext } from "../../../src/contracts/IResponseGenerator.js";
import {
  ConversationMessage,
  MessageDirection,
} from "../../../src/domain/entities/ConversationMessage.js";
import { LeadConversation } from "../../../src/domain/entities/LeadConversation.js";
import { LeadProfile } from "../../../src/domain/entities/LeadProfile.js";
import { ConversationStage } from "../../../src/domain/value-objects/ConversationStage.js";
import { LeadScore } from "../../../src/domain/value-objects/LeadScore.js";
import { buildConversationMessages, buildSystemPrompt } from "../../../src/llm/buildClaraPrompt.js";
import { unwrap } from "../../helpers/result.js";

const NOW = new Date("2026-08-10T09:00:00.000Z");

function unit() {
  return unwrap(
    new InventoryUnitBuilder()
      .withBrand("Mitsubishi")
      .withModel("Xpander Cross")
      .withTransmission(UnitTransmission.AT)
      .withYear(2019)
      .withBranch(Branch.CINERE)
      .build(),
  );
}

function baseContext(overrides: Partial<ResponseContext> = {}): ResponseContext {
  return {
    conversation: LeadConversation.start("+6281200000001", BranchId.CINERE, NOW),
    stage: ConversationStage.GREETING,
    intents: [],
    messageText: "halo",
    matchedUnits: [],
    branchName: "Mobix Cinere",
    ...overrides,
  };
}

describe("buildSystemPrompt", () => {
  it("interpolates branch, score, stage, and the stage instruction", () => {
    const context = baseContext({
      stage: ConversationStage.DISCOVERY,
      conversation: LeadConversation.start("+6281200000001", BranchId.CINERE, NOW).withScore(
        LeadScore.zero().apply(42),
      ),
    });
    const prompt = buildSystemPrompt(context);
    expect(prompt).toContain("Kamu adalah Clara");
    expect(prompt).toContain("Branch: Mobix Cinere");
    expect(prompt).toContain("Lead score: 42/100");
    expect(prompt).toContain("Stage: DISCOVERY");
    expect(prompt).toContain("Tidak lebih dari 150 karakter per pesan");
  });

  it("lead_profile slot says 'belum ada info' when nothing is known yet", () => {
    const prompt = buildSystemPrompt(baseContext());
    expect(prompt).toContain("Info yang sudah diketahui: belum ada info");
  });

  it("lead_profile slot lists every known field", () => {
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW).withProfile(
      LeadProfile.create({
        budget: "200 juta",
        unit: "Xpander",
        area: "Cinere",
        paymentMethod: "kredit",
        qualified: new Set(),
      }),
    );
    const prompt = buildSystemPrompt(baseContext({ conversation }));
    expect(prompt).toContain("budget: 200 juta");
    expect(prompt).toContain("unit diminati: Xpander");
    expect(prompt).toContain("area: Cinere");
    expect(prompt).toContain("payment: kredit");
  });

  it("available_units slot says 'tidak ada unit yang cocok saat ini' when matchedUnits is empty", () => {
    const prompt = buildSystemPrompt(baseContext());
    expect(prompt).toContain("Unit tersedia: tidak ada unit yang cocok saat ini");
  });

  it("available_units slot lists matched units' display names", () => {
    const prompt = buildSystemPrompt(baseContext({ matchedUnits: [unit()] }));
    expect(prompt).toContain(unit().displayName);
  });

  it("every ConversationStage has a stage_instruction (no unresolved '{stage_instruction}' slot)", () => {
    for (const stage of Object.values(ConversationStage)) {
      const prompt = buildSystemPrompt(baseContext({ stage }));
      expect(prompt).not.toContain("{stage_instruction}");
      expect(prompt).not.toContain("{branch}");
      expect(prompt).not.toContain("{score}");
      expect(prompt).not.toContain("{stage}");
      expect(prompt).not.toContain("{lead_profile}");
      expect(prompt).not.toContain("{available_units}");
    }
  });
});

describe("buildConversationMessages", () => {
  it("first message is the system prompt", () => {
    const messages = buildConversationMessages(baseContext());
    expect(messages[0]?.role).toBe("system");
    expect(messages[0]?.content).toContain("Kamu adalah Clara");
  });

  it("maps INBOUND messages to role 'user' and OUTBOUND to 'assistant', in order", () => {
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW)
      .withAppendedMessage(
        unwrap(
          ConversationMessage.create({
            text: "halo min",
            direction: MessageDirection.INBOUND,
            occurredAt: NOW,
          }),
        ),
        NOW,
      )
      .withAppendedMessage(
        unwrap(
          ConversationMessage.create({
            text: "Halo kak! 👋",
            direction: MessageDirection.OUTBOUND,
            occurredAt: NOW,
          }),
        ),
        NOW,
      );
    const messages = buildConversationMessages(baseContext({ conversation }));
    expect(messages.slice(1)).toEqual([
      { role: "user", content: "halo min" },
      { role: "assistant", content: "Halo kak! 👋" },
    ]);
  });

  it("only keeps the most recent 10 history messages", () => {
    let conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    for (let i = 0; i < 15; i += 1) {
      conversation = conversation.withAppendedMessage(
        unwrap(
          ConversationMessage.create({
            text: `pesan ${i}`,
            direction: i % 2 === 0 ? MessageDirection.INBOUND : MessageDirection.OUTBOUND,
            occurredAt: NOW,
          }),
        ),
        NOW,
      );
    }
    const messages = buildConversationMessages(baseContext({ conversation }));
    expect(messages).toHaveLength(11); // 1 system + 10 most recent
    expect(messages[1]?.content).toBe("pesan 5");
    expect(messages[10]?.content).toBe("pesan 14");
  });
});
