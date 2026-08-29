import { PersonaDifficulty, PersonaId, SessionId } from "@aos/conversation-simulator";
import { describe, expect, it } from "vitest";

import { ObservablePublisher } from "../../../../src/application/services/ObservablePublisher.js";
import { CompareVersions } from "../../../../src/application/use-cases/CompareVersions.js";
import { JudgementResultBuilder } from "../../../../src/builders/JudgementResultBuilder.js";
import { DEFAULT_AI_JUDGE_CONFIG } from "../../../../src/config/AiJudgeConfig.js";
import { AiJudgeEvents } from "../../../../src/domain/events/AiJudgeEvents.js";
import { DimensionName } from "../../../../src/domain/value-objects/DimensionName.js";
import { DimensionScoreValue } from "../../../../src/domain/value-objects/DimensionScoreValue.js";
import { AiJudgeFactory } from "../../../../src/factories/AiJudgeFactory.js";
import {
  BUYER,
  CLARA,
  makeMessage,
  makeSimulationResult,
} from "../../../fixtures/simulationResultFixtures.js";

describe("CompareVersions", () => {
  it("compares two JudgementResults for the same persona and publishes VersionCompared", async () => {
    const publisher = new ObservablePublisher();
    const factory = AiJudgeFactory.create({ publisher });
    expect(factory.ok).toBe(true);
    if (!factory.ok) return;

    const before = await factory.value.judgeConversation.execute(
      makeSimulationResult({
        messages: [makeMessage(1, CLARA, "Halo, saya Clara dari Mobix By DSS Motor.")],
      }),
    );
    const after = await factory.value.judgeConversation.execute(
      makeSimulationResult({
        messages: [
          makeMessage(1, BUYER, "halo"),
          makeMessage(2, CLARA, "Halo kak 😊 mau tanya apa nih?"),
        ],
      }),
    );
    expect(before.ok).toBe(true);
    expect(after.ok).toBe(true);
    if (!before.ok || !after.ok) return;

    const report = await factory.value.compareVersions.execute(before.value, after.value);
    expect(report.ok).toBe(true);
    if (!report.ok) return;

    expect(report.value.dimensionDeltas).toHaveLength(6);
    expect(publisher.published.some((e) => e.type === "aaos.judge.version.compared")).toBe(true);
  });

  it("defaults the clock to the current time when none is injected", async () => {
    const publisher = new ObservablePublisher();
    const events = new AiJudgeEvents(publisher);
    const useCase = new CompareVersions(events, DEFAULT_AI_JUDGE_CONFIG);

    function dim(dimension: DimensionName, value: number) {
      return { dimension, score: DimensionScoreValue.of(value), appliedRules: [] };
    }
    function judgementAt(value: number, sessionId: string) {
      return JudgementResultBuilder.build({
        sessionId: SessionId.create(sessionId),
        personaId: PersonaId.READY_BUYER,
        personaDifficulty: PersonaDifficulty.EASY,
        dimensions: {
          naturalLanguage: dim(DimensionName.NATURAL_LANGUAGE, value),
          qualification: dim(DimensionName.QUALIFICATION, value),
          objectionHandling: dim(DimensionName.OBJECTION_HANDLING, value),
          closingAttempt: dim(DimensionName.CLOSING_ATTEMPT, value),
          handoffQuality: dim(DimensionName.HANDOFF_QUALITY, value),
          responseLength: dim(DimensionName.RESPONSE_LENGTH, value),
        },
        config: DEFAULT_AI_JUDGE_CONFIG,
        now: new Date(2026, 0, 1),
      });
    }

    const before = Date.now();
    const report = await useCase.execute(judgementAt(5, "s1"), judgementAt(7, "s2"));
    const after = Date.now();
    expect(report.ok).toBe(true);
    if (!report.ok) return;
    expect(report.value.comparedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(report.value.comparedAt.getTime()).toBeLessThanOrEqual(after);
  });
});
