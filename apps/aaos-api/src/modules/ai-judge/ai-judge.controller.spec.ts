import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { AiJudgeController } from "./ai-judge.controller.js";
import type { AiJudgeService, IngestSimulationBatchResult } from "./ai-judge.service.js";
import type { IngestSimulationBatchBodyDto } from "./dto/ingest-simulation-batch.dto.js";

function buildFakeService(): AiJudgeService {
  return {
    ingestSimulationBatch: vi.fn(
      async () =>
        ({ agentRunId: "run-1", judgeResultId: "judge-1" }) as IngestSimulationBatchResult,
    ),
  } as unknown as AiJudgeService;
}

const BODY: IngestSimulationBatchBodyDto = {
  judgedAt: "2026-09-01T10:00:00.000Z",
  totalPersonas: 1,
  approvedCount: 0,
  needsImprovementCount: 0,
  failCount: 1,
  overallVerdict: "FAIL",
  avgOverallScore: 40,
  weakestDimensions: [{ dimension: "responseLength", avgScore: 3 }],
  topPriorities: [],
  results: [
    {
      personaId: "cold-buyer",
      personaDifficulty: "HARD",
      grade: "F",
      verdict: "FAIL",
      overallScore: 40,
      naturalLanguage: 4,
      qualification: 4,
      objectionHandling: 4,
      closingAttempt: 4,
      handoffQuality: 4,
      responseLength: 3,
      highlights: [],
      improvementSuggestions: [],
    },
  ],
};

describe("AiJudgeController", () => {
  it("POST /api/v1/ai-judge/simulation-batch delegates to AiJudgeService.ingestSimulationBatch with the caller's tenant id + body", async () => {
    const service = buildFakeService();
    const controller = new AiJudgeController(service);

    const result = await controller.ingestSimulationBatch("dss-motor", BODY);

    expect(service.ingestSimulationBatch).toHaveBeenCalledWith("dss-motor", BODY);
    expect(result).toEqual({ agentRunId: "run-1", judgeResultId: "judge-1" });
  });

  it("guards the whole controller with ApiKeyGuard", () => {
    const guards = Reflect.getMetadata("__guards__", AiJudgeController) as unknown[];
    expect(guards).toContain(ApiKeyGuard);
  });
});
