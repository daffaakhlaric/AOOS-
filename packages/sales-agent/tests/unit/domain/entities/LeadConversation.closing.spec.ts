import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { LeadConversation } from "../../../../src/domain/entities/LeadConversation.js";
import { ConversationStage } from "../../../../src/domain/value-objects/ConversationStage.js";
import { LeadScore } from "../../../../src/domain/value-objects/LeadScore.js";
import { QualificationStatus } from "../../../../src/domain/value-objects/QualificationStatus.js";
import { unwrap } from "../../../helpers/result.js";

const NOW = new Date("2026-08-10T09:00:00.000Z");

describe("LeadConversation — closing/qualification tracking (AAOS-W3D)", () => {
  it("start() begins with closingAttemptCount 0, scoreAtLastClosingAttempt 0, and empty askedCriteria", () => {
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    expect(conversation.closingAttemptCount).toBe(0);
    expect(conversation.scoreAtLastClosingAttempt).toBe(0);
    expect(conversation.askedCriteria.size).toBe(0);
  });

  it("withClosingAttempt() increments closingAttemptCount and returns a NEW instance", () => {
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const attempted = conversation.withClosingAttempt();
    expect(conversation.closingAttemptCount).toBe(0);
    expect(attempted.closingAttemptCount).toBe(1);
    expect(attempted).not.toBe(conversation);
  });

  it("withClosingAttempt() records the current score as scoreAtLastClosingAttempt", () => {
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW).withScore(
      LeadScore.zero().apply(55),
    );
    const attempted = conversation.withClosingAttempt();
    expect(attempted.scoreAtLastClosingAttempt).toBe(55);
  });

  it("withClosingAttempt() called twice increments to 2", () => {
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW)
      .withClosingAttempt()
      .withClosingAttempt();
    expect(conversation.closingAttemptCount).toBe(2);
  });

  it("withAskedCriterion() adds the criterion and returns a NEW instance", () => {
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const asked = conversation.withAskedCriterion(QualificationStatus.BUDGET);
    expect(conversation.askedCriteria.size).toBe(0);
    expect(asked.askedCriteria.has(QualificationStatus.BUDGET)).toBe(true);
    expect(asked).not.toBe(conversation);
  });

  it("withAskedCriterion() accumulates across multiple calls", () => {
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW)
      .withAskedCriterion(QualificationStatus.BUDGET)
      .withAskedCriterion(QualificationStatus.AREA);
    expect(conversation.askedCriteria.has(QualificationStatus.BUDGET)).toBe(true);
    expect(conversation.askedCriteria.has(QualificationStatus.AREA)).toBe(true);
    expect(conversation.askedCriteria.has(QualificationStatus.UNIT)).toBe(false);
  });

  it("withAskedCriterion() with the same criterion twice keeps the set at size 1 (idempotent)", () => {
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW)
      .withAskedCriterion(QualificationStatus.BUDGET)
      .withAskedCriterion(QualificationStatus.BUDGET);
    expect(conversation.askedCriteria.size).toBe(1);
  });

  it("create() defaults closingAttemptCount/scoreAtLastClosingAttempt/askedCriteria when omitted (pre-existing call sites keep working)", () => {
    const conversation = unwrap(
      LeadConversation.create({
        id: LeadConversation.start("x", BranchId.CINERE, NOW).id,
        leadPhone: "+6281200000001",
        branchId: BranchId.CINERE,
        stage: ConversationStage.GREETING,
        score: LeadScore.zero(),
        profile: LeadConversation.start("x", BranchId.CINERE, NOW).profile,
        messages: [],
        startedAt: NOW,
        lastMessageAt: NOW,
        closed: false,
      }),
    );
    expect(conversation.closingAttemptCount).toBe(0);
    expect(conversation.scoreAtLastClosingAttempt).toBe(0);
    expect(conversation.askedCriteria.size).toBe(0);
  });

  it("create() honors explicitly-provided closingAttemptCount/askedCriteria", () => {
    const conversation = unwrap(
      LeadConversation.create({
        id: LeadConversation.start("x", BranchId.CINERE, NOW).id,
        leadPhone: "+6281200000001",
        branchId: BranchId.CINERE,
        stage: ConversationStage.GREETING,
        score: LeadScore.zero(),
        profile: LeadConversation.start("x", BranchId.CINERE, NOW).profile,
        messages: [],
        startedAt: NOW,
        lastMessageAt: NOW,
        closed: false,
        closingAttemptCount: 2,
        scoreAtLastClosingAttempt: 50,
        askedCriteria: new Set([QualificationStatus.BUDGET]),
      }),
    );
    expect(conversation.closingAttemptCount).toBe(2);
    expect(conversation.scoreAtLastClosingAttempt).toBe(50);
    expect(conversation.askedCriteria.has(QualificationStatus.BUDGET)).toBe(true);
  });

  it("withScore()/withStage() preserve closingAttemptCount and askedCriteria unchanged", () => {
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW)
      .withClosingAttempt()
      .withAskedCriterion(QualificationStatus.UNIT);
    const restaged = conversation
      .withStage(ConversationStage.QUALIFICATION)
      .withScore(LeadScore.zero().apply(10));
    expect(restaged.closingAttemptCount).toBe(1);
    expect(restaged.askedCriteria.has(QualificationStatus.UNIT)).toBe(true);
  });
});
