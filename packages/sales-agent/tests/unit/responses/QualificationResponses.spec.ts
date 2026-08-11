import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { LeadConversation } from "../../../src/domain/entities/LeadConversation.js";
import { LeadProfile } from "../../../src/domain/entities/LeadProfile.js";
import { QualificationStatus } from "../../../src/domain/value-objects/QualificationStatus.js";
import {
  ASK_AREA_POOL,
  ASK_BUDGET_POOL,
  ASK_PAYMENT_POOL,
  ASK_UNIT_POOL,
  nextCriterionToAsk,
  QualificationResponses,
} from "../../../src/responses/QualificationResponses.js";

const NOW = new Date("2026-08-10T09:00:00.000Z");

function conversationWith(
  profile: LeadProfile,
  asked: ReadonlySet<QualificationStatus> = new Set(),
): LeadConversation {
  let conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW).withProfile(
    profile,
  );
  for (const criterion of asked) {
    conversation = conversation.withAskedCriterion(criterion);
  }
  return conversation;
}

describe("QualificationResponses pools (AAOS-W3D Fix 3)", () => {
  it("ASK_BUDGET_POOL: every entry ≤ 150 chars", () => {
    expect(ASK_BUDGET_POOL.length).toBeGreaterThan(0);
    for (const entry of ASK_BUDGET_POOL) {
      expect(entry.length).toBeLessThanOrEqual(150);
    }
  });

  it("ASK_UNIT_POOL: every entry ≤ 100 chars", () => {
    expect(ASK_UNIT_POOL.length).toBeGreaterThan(0);
    for (const entry of ASK_UNIT_POOL) {
      expect(entry.length).toBeLessThanOrEqual(100);
    }
  });

  it("ASK_AREA_POOL: every entry ≤ 150 chars", () => {
    expect(ASK_AREA_POOL.length).toBeGreaterThan(0);
    for (const entry of ASK_AREA_POOL) {
      expect(entry.length).toBeLessThanOrEqual(150);
    }
  });

  it("ASK_PAYMENT_POOL: every entry ≤ 150 chars", () => {
    expect(ASK_PAYMENT_POOL.length).toBeGreaterThan(0);
    for (const entry of ASK_PAYMENT_POOL) {
      expect(entry.length).toBeLessThanOrEqual(150);
    }
  });

  describe("QualificationResponses.askFor", () => {
    it("askFor(BUDGET) returns from ASK_BUDGET_POOL", () => {
      expect(ASK_BUDGET_POOL).toContain(
        QualificationResponses.askFor(QualificationStatus.BUDGET, 0),
      );
    });

    it("askFor(UNIT) returns from ASK_UNIT_POOL", () => {
      expect(ASK_UNIT_POOL).toContain(QualificationResponses.askFor(QualificationStatus.UNIT, 0));
    });

    it("askFor(AREA) returns from ASK_AREA_POOL", () => {
      expect(ASK_AREA_POOL).toContain(QualificationResponses.askFor(QualificationStatus.AREA, 0));
    });

    it("askFor(PAYMENT) returns from ASK_PAYMENT_POOL", () => {
      expect(ASK_PAYMENT_POOL).toContain(
        QualificationResponses.askFor(QualificationStatus.PAYMENT, 0),
      );
    });

    it("is deterministic for a given seed", () => {
      const first = QualificationResponses.askFor(QualificationStatus.BUDGET, 2);
      const second = QualificationResponses.askFor(QualificationStatus.BUDGET, 2);
      expect(first).toBe(second);
    });
  });

  describe("nextCriterionToAsk", () => {
    it("nothing extracted, nothing asked → BUDGET first (declared order)", () => {
      const conversation = conversationWith(LeadProfile.empty());
      expect(nextCriterionToAsk(conversation)).toBe(QualificationStatus.BUDGET);
    });

    it("BUDGET already extracted → next is UNIT", () => {
      const profile = LeadProfile.empty().withEnrichment(
        { budget: "200 juta" },
        QualificationStatus.BUDGET,
      );
      const conversation = conversationWith(profile);
      expect(nextCriterionToAsk(conversation)).toBe(QualificationStatus.UNIT);
    });

    it("BUDGET and UNIT extracted → next is AREA", () => {
      const profile = LeadProfile.empty()
        .withEnrichment({ budget: "200 juta" }, QualificationStatus.BUDGET)
        .withEnrichment({ unit: "Xpander" }, QualificationStatus.UNIT);
      const conversation = conversationWith(profile);
      expect(nextCriterionToAsk(conversation)).toBe(QualificationStatus.AREA);
    });

    it("BUDGET, UNIT, AREA extracted → next is PAYMENT", () => {
      const profile = LeadProfile.empty()
        .withEnrichment({ budget: "200 juta" }, QualificationStatus.BUDGET)
        .withEnrichment({ unit: "Xpander" }, QualificationStatus.UNIT)
        .withEnrichment({ area: "Cinere" }, QualificationStatus.AREA);
      const conversation = conversationWith(profile);
      expect(nextCriterionToAsk(conversation)).toBe(QualificationStatus.PAYMENT);
    });

    it("all 4 core criteria extracted → undefined", () => {
      const profile = LeadProfile.empty()
        .withEnrichment({ budget: "200 juta" }, QualificationStatus.BUDGET)
        .withEnrichment({ unit: "Xpander" }, QualificationStatus.UNIT)
        .withEnrichment({ area: "Cinere" }, QualificationStatus.AREA)
        .withEnrichment({ paymentMethod: "Cash" }, QualificationStatus.PAYMENT);
      const conversation = conversationWith(profile);
      expect(nextCriterionToAsk(conversation)).toBeUndefined();
    });

    it("a criterion already asked (but not extracted) is skipped — never asked twice", () => {
      const conversation = conversationWith(
        LeadProfile.empty(),
        new Set([QualificationStatus.BUDGET]),
      );
      expect(nextCriterionToAsk(conversation)).toBe(QualificationStatus.UNIT);
    });

    it("BUDGET asked AND UNIT asked, none extracted → next is AREA", () => {
      const conversation = conversationWith(
        LeadProfile.empty(),
        new Set([QualificationStatus.BUDGET, QualificationStatus.UNIT]),
      );
      expect(nextCriterionToAsk(conversation)).toBe(QualificationStatus.AREA);
    });

    it("all 4 already asked (none extracted) → undefined, never re-asks", () => {
      const conversation = conversationWith(
        LeadProfile.empty(),
        new Set([
          QualificationStatus.BUDGET,
          QualificationStatus.UNIT,
          QualificationStatus.AREA,
          QualificationStatus.PAYMENT,
        ]),
      );
      expect(nextCriterionToAsk(conversation)).toBeUndefined();
    });

    it("TIMELINE/NAME extraction never blocks the 4 core criteria from being asked", () => {
      const profile = LeadProfile.empty().withEnrichment(
        { timeline: "minggu ini" },
        QualificationStatus.TIMELINE,
      );
      const conversation = conversationWith(profile);
      expect(nextCriterionToAsk(conversation)).toBe(QualificationStatus.BUDGET);
    });
  });
});
