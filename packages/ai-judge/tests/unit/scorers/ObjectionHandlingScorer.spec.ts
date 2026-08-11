import { ConversationStage } from "@aos/sales-agent";
import { describe, expect, it } from "vitest";

import { ObjectionHandlingScorer } from "../../../src/scorers/ObjectionHandlingScorer.js";
import {
  BUYER,
  JESSY,
  makeMessage,
  makeSimulationResult,
} from "../../fixtures/simulationResultFixtures.js";

function ruleFrom(
  appliedRules: ReadonlyArray<{ rule: string; points: number }>,
  rule: string,
): number {
  return appliedRules.find((r) => r.rule === rule)?.points ?? NaN;
}

const scorer = new ObjectionHandlingScorer();

describe("ObjectionHandlingScorer", () => {
  it("no objection signal anywhere in the lead's messages -> score 10 (N/A)", () => {
    const sim = makeSimulationResult({
      messages: [makeMessage(1, BUYER, "mau xpander kak"), makeMessage(2, JESSY, "siap kak")],
      stageTransitions: [],
    });
    const result = scorer.score(sim);
    expect(result.score.value).toBe(10);
    expect(result.appliedRules[0]?.rule).toBe("NO_OBJECTION_PRESENT");
  });

  it("objection present, OBJECTION stage entered -> ENTERED_OBJECTION_STAGE +4", () => {
    const sim = makeSimulationResult({
      messages: [
        makeMessage(1, BUYER, "aku takut nanti bermasalah kak"),
        makeMessage(2, JESSY, "Tenang kak, unit kita udah lewat Otospector, inspeksi 150 titik 🙏"),
      ],
      stageTransitions: [
        { turn: 2, from: ConversationStage.DISCOVERY, to: ConversationStage.OBJECTION },
      ],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "ENTERED_OBJECTION_STAGE")).toBe(4);
  });

  it("response mentions Otospector -> MENTIONS_MOBIX_USP +3", () => {
    const sim = makeSimulationResult({
      messages: [
        makeMessage(1, BUYER, "beneran aman gak kak unitnya"),
        makeMessage(2, JESSY, "Aman banget kak, sudah dicek Otospector."),
      ],
      stageTransitions: [
        { turn: 2, from: ConversationStage.DISCOVERY, to: ConversationStage.OBJECTION },
      ],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "MENTIONS_MOBIX_USP")).toBe(3);
  });

  it("response mentions '150 titik' -> MENTIONS_MOBIX_USP +3", () => {
    const sim = makeSimulationResult({
      messages: [
        makeMessage(1, BUYER, "ragu deh kak"),
        makeMessage(2, JESSY, "Sudah inspeksi 150 titik kak, aman."),
      ],
      stageTransitions: [
        { turn: 2, from: ConversationStage.DISCOVERY, to: ConversationStage.OBJECTION },
      ],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "MENTIONS_MOBIX_USP")).toBe(3);
  });

  it("response mentions 'garansi' -> MENTIONS_MOBIX_USP +3", () => {
    const sim = makeSimulationResult({
      messages: [
        makeMessage(1, BUYER, "khawatir kak"),
        makeMessage(2, JESSY, "Ada garansi resmi kak, tenang aja."),
      ],
      stageTransitions: [
        { turn: 2, from: ConversationStage.DISCOVERY, to: ConversationStage.OBJECTION },
      ],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "MENTIONS_MOBIX_USP")).toBe(3);
  });

  it("empathetic (not pushy) response -> EMPATHETIC +2", () => {
    const sim = makeSimulationResult({
      messages: [
        makeMessage(1, BUYER, "mahal banget sih"),
        makeMessage(2, JESSY, "Wajar kak kalau ragu soal harga."),
      ],
      stageTransitions: [
        { turn: 2, from: ConversationStage.DISCOVERY, to: ConversationStage.OBJECTION },
      ],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "EMPATHETIC")).toBe(2);
  });

  it("pushy response ('harus beli sekarang') -> PUSHY_RESPONSE -2, EMPATHETIC not awarded", () => {
    const sim = makeSimulationResult({
      messages: [
        makeMessage(1, BUYER, "mahal banget kak"),
        makeMessage(2, JESSY, "Harus beli sekarang kak, stok terbatas banget!"),
      ],
      stageTransitions: [
        { turn: 2, from: ConversationStage.DISCOVERY, to: ConversationStage.OBJECTION },
      ],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "PUSHY_RESPONSE")).toBe(-2);
    expect(ruleFrom(result.appliedRules, "EMPATHETIC")).toBe(0);
  });

  it("concise objection response (<=200 chars) -> CONCISE_OBJECTION_RESPONSE +1", () => {
    const sim = makeSimulationResult({
      messages: [
        makeMessage(1, BUYER, "ragu kak"),
        makeMessage(2, JESSY, "Wajar kak, boleh tanya apa aja."),
      ],
      stageTransitions: [
        { turn: 2, from: ConversationStage.DISCOVERY, to: ConversationStage.OBJECTION },
      ],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "CONCISE_OBJECTION_RESPONSE")).toBe(1);
  });

  it("wall-of-text response (>300 chars) -> WALL_OF_TEXT -1", () => {
    const sim = makeSimulationResult({
      messages: [makeMessage(1, BUYER, "ragu kak"), makeMessage(2, JESSY, "z".repeat(301))],
      stageTransitions: [
        { turn: 2, from: ConversationStage.DISCOVERY, to: ConversationStage.OBJECTION },
      ],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "WALL_OF_TEXT")).toBe(-1);
  });

  it("objection present but no OBJECTION stage transition -> MISSED_OBJECTION_STAGE -3 (design resolution #1: reachable)", () => {
    const sim = makeSimulationResult({
      messages: [
        makeMessage(1, BUYER, "aku takut bermasalah kak"),
        makeMessage(2, JESSY, "Oke kak, xpander ready kok."),
      ],
      stageTransitions: [],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "MISSED_OBJECTION_STAGE")).toBe(-3);
    expect(ruleFrom(result.appliedRules, "ENTERED_OBJECTION_STAGE")).toBeNaN();
  });

  it("COMPLAINT-only signal (friend had a bad experience) is also ground-truthed as an objection", () => {
    const sim = makeSimulationResult({
      messages: [
        makeMessage(1, BUYER, "temen aku pernah beli disini terus rusak, kecewa banget katanya"),
        makeMessage(2, JESSY, "Wah maaf kak, boleh cerita lebih detail?"),
      ],
      stageTransitions: [],
    });
    const result = scorer.score(sim);
    expect(result.appliedRules.some((r) => r.rule === "NO_OBJECTION_PRESENT")).toBe(false);
  });

  it("when no Jessy response follows the objection, response text defaults to empty and dimension still scores deterministically", () => {
    const sim = makeSimulationResult({
      messages: [makeMessage(1, BUYER, "ragu deh kak")],
      stageTransitions: [],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "CONCISE_OBJECTION_RESPONSE")).toBe(0);
    expect(ruleFrom(result.appliedRules, "MENTIONS_MOBIX_USP")).toBe(0);
  });

  it("score is clamped 0-10", () => {
    const sim = makeSimulationResult({
      messages: [
        makeMessage(1, BUYER, "aku takut bermasalah kak"),
        makeMessage(
          2,
          JESSY,
          "Tenang kak, sudah lewat Otospector inspeksi 150 titik dan ada garansi 🙏",
        ),
      ],
      stageTransitions: [
        { turn: 2, from: ConversationStage.DISCOVERY, to: ConversationStage.OBJECTION },
      ],
    });
    const result = scorer.score(sim);
    expect(result.score.value).toBeLessThanOrEqual(10);
    expect(result.score.value).toBeGreaterThanOrEqual(0);
  });
});
