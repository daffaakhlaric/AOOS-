import { PersonaDifficulty, PersonaId, SimulationStatus } from "@aos/conversation-simulator";
import { ConversationStage, LeadTemperature } from "@aos/sales-agent";
import { Grade, Verdict } from "@aos/ai-judge";

import type {
  AllScenariosReportDto,
  DimensionScoreDto,
  JudgementResultDto,
  LearningBridgeStatusDto,
  PersonaSummary,
  PromptOverrideStatusDto,
  SimulateAllResponse,
  SimulateAllResultEntry,
  SimulationMessageDto,
  SimulationResultDto,
} from "@/types/simulator.types";

/**
 * Test-only fixtures — importing the real `@aos/conversation-simulator`/`@aos/ai-judge`/
 * `@aos/sales-agent` enums as *values* here is fine (unlike in `src/**`): this file is only ever
 * loaded by Vitest under Node, never bundled into the Next.js client/server production output, so
 * design resolution #5's client-bundling boundary doesn't apply to test code.
 *
 * The 10 real DSS Motor buyer personas (spec "10 Buyer Personas") — names/difficulty mirror
 * `packages/conversation-simulator/src/personas/*.ts` exactly.
 */
export const TEST_PERSONAS: ReadonlyArray<PersonaSummary> = [
  {
    id: PersonaId.COLD_BUYER,
    name: "Cold Buyer",
    difficulty: PersonaDifficulty.EASY,
    description: "Baru lihat-lihat, belum niat beli.",
  },
  {
    id: PersonaId.BUDGET_BUYER,
    name: "Budget Buyer",
    difficulty: PersonaDifficulty.MEDIUM,
    description: "Sangat sensitif harga.",
  },
  {
    id: PersonaId.READY_BUYER,
    name: "Ready Buyer",
    difficulty: PersonaDifficulty.EASY,
    description: "Siap beli, tinggal deal.",
  },
  {
    id: PersonaId.SPECIFIC_UNIT_BUYER,
    name: "Specific Unit Buyer",
    difficulty: PersonaDifficulty.MEDIUM,
    description: "Cari unit spesifik.",
  },
  {
    id: PersonaId.KREDIT_BUYER,
    name: "Kredit Buyer",
    difficulty: PersonaDifficulty.MEDIUM,
    description: "Butuh skema kredit.",
  },
  {
    id: PersonaId.SYARIAH_BUYER,
    name: "Syariah Buyer",
    difficulty: PersonaDifficulty.MEDIUM,
    description: "Butuh skema syariah.",
  },
  {
    id: PersonaId.GHOST_BUYER,
    name: "Ghost Buyer",
    difficulty: PersonaDifficulty.HARD,
    description: "Menghilang di tengah chat.",
  },
  {
    id: PersonaId.COMPLAINER_BUYER,
    name: "Complainer Buyer",
    difficulty: PersonaDifficulty.HARD,
    description: "Banyak komplain.",
  },
  {
    id: PersonaId.FIRST_TIME_BUYER,
    name: "First Time Buyer",
    difficulty: PersonaDifficulty.MEDIUM,
    description: "Baru pertama kali beli motor bekas.",
  },
  {
    id: PersonaId.URGENT_BUYER,
    name: "Urgent Buyer",
    difficulty: PersonaDifficulty.EASY,
    description: "Butuh motor cepat.",
  },
];

export function buildMessage(overrides: Partial<SimulationMessageDto> = {}): SimulationMessageDto {
  return {
    turn: 1,
    speaker: "BUYER",
    text: "halo min, ada Xpander?",
    occurredAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    ...overrides,
  };
}

export function buildSimulationResult(
  overrides: Partial<SimulationResultDto> = {},
): SimulationResultDto {
  return {
    sessionId: "sim-ready_buyer-1-1",
    personaId: PersonaId.READY_BUYER,
    personaDifficulty: PersonaDifficulty.EASY,
    status: SimulationStatus.COMPLETED,
    messages: [
      buildMessage({ turn: 1, speaker: "BUYER", text: "mau beli Xpander budget 200 juta" }),
      buildMessage({
        turn: 2,
        speaker: "CLARA",
        text: "Ada kak! Xpander Cross 2019, harga 195jt, km 45rb",
      }),
      buildMessage({ turn: 3, speaker: "BUYER", text: "bisa survey besok?" }),
      buildMessage({
        turn: 4,
        speaker: "CLARA",
        text: "Bisa kak! Clara sambungkan ke tim kita ya",
      }),
    ],
    totalTurns: 4,
    durationMs: 23_000,
    finalScore: 88,
    finalTemperature: LeadTemperature.HOT,
    handoffTriggered: true,
    handoffAtTurn: 4,
    scoreProgression: [{ turn: 1, score: 20, delta: 20, reason: "greeting" }],
    stageTransitions: [
      { turn: 1, from: ConversationStage.GREETING, to: ConversationStage.DISCOVERY },
    ],
    finalStage: ConversationStage.HANDOFF,
    expectedOutcome: LeadTemperature.HOT,
    metExpectation: true,
    avgClaraResponseLength: 142,
    maxClaraResponseLength: 187,
    longestClaraMessage: "Ada kak! Xpander Cross 2019, harga 195jt, km 45rb DP mulai 29jt",
    claraUsedInventory: true,
    claraHandledObjection: false,
    followUpScheduled: false,
    ...overrides,
  };
}

export function buildDimensionScore(overrides: Partial<DimensionScoreDto> = {}): DimensionScoreDto {
  return {
    dimension: "NATURAL_LANGUAGE",
    score: 8,
    appliedRules: [{ rule: "SOME_RULE", points: 8, note: "Some note." }],
    ...overrides,
  };
}

export function buildNotApplicableDimensionScore(
  rule: "NO_OBJECTION_PRESENT" | "NO_HANDOFF_NEEDED",
  overrides: Partial<DimensionScoreDto> = {},
): DimensionScoreDto {
  return {
    dimension: rule === "NO_OBJECTION_PRESENT" ? "OBJECTION_HANDLING" : "HANDOFF_QUALITY",
    score: 10,
    appliedRules: [{ rule, points: 10, note: "N/A default." }],
    ...overrides,
  };
}

export function buildJudgementResult(
  overrides: Partial<JudgementResultDto> = {},
): JudgementResultDto {
  return {
    id: "judgement-sim-ready_buyer-1-1-1",
    simulationSessionId: "sim-ready_buyer-1-1",
    personaId: PersonaId.READY_BUYER,
    personaDifficulty: PersonaDifficulty.EASY,
    judgedAt: new Date("2026-01-01T00:00:05.000Z").toISOString(),
    naturalLanguage: buildDimensionScore({ dimension: "NATURAL_LANGUAGE", score: 8 }),
    qualification: buildDimensionScore({ dimension: "QUALIFICATION", score: 10 }),
    objectionHandling: buildNotApplicableDimensionScore("NO_OBJECTION_PRESENT"),
    closingAttempt: buildDimensionScore({ dimension: "CLOSING_ATTEMPT", score: 9 }),
    handoffQuality: buildDimensionScore({ dimension: "HANDOFF_QUALITY", score: 10 }),
    responseLength: buildDimensionScore({ dimension: "RESPONSE_LENGTH", score: 9 }),
    overallScore: 85,
    grade: Grade.B_PLUS,
    verdict: Verdict.APPROVE,
    feedbackItems: [
      { dimension: "RESPONSE_LENGTH", message: "Pesan ke-3 agak panjang (187 karakter)." },
    ],
    improvementSuggestions: [
      { dimension: "CLOSING_ATTEMPT", priority: "LOW", suggestion: "Closing bisa lebih awal." },
    ],
    highlights: [
      "Berhasil qualify semua 4 kriteria dalam 4 turn",
      "Respon singkat, rata-rata 142 karakter",
    ],
    isGoldenCandidate: true,
    ...overrides,
  };
}

export function buildAllScenariosReport(
  overrides: Partial<AllScenariosReportDto> = {},
): AllScenariosReportDto {
  return {
    judgedAt: new Date("2026-01-01T00:00:10.000Z").toISOString(),
    totalPersonas: 10,
    approvedCount: 5,
    needsImprovementCount: 5,
    failCount: 0,
    overallVerdict: Verdict.APPROVE,
    avgOverallScore: 82,
    results: [],
    weakestDimensions: [
      { dimension: "OBJECTION_HANDLING", avgScore: 6.2 },
      { dimension: "CLOSING_ATTEMPT", avgScore: 7.1 },
    ],
    topPriorities: [
      "Clara perlu response yang lebih baik untuk keberatan soal harga",
      "Closing attempt bisa lebih awal untuk lead warm",
    ],
    goldenCandidates: ["sim-ready_buyer-1-1"],
    ...overrides,
  };
}

export function buildSimulateAllResultEntry(
  overrides: Partial<SimulateAllResultEntry> = {},
): SimulateAllResultEntry {
  return {
    personaId: PersonaId.READY_BUYER,
    simulationResult: buildSimulationResult(),
    judgementResult: buildJudgementResult(),
    ...overrides,
  };
}

/** Self-Learning AI bridge phase — default `SKIPPED` (the honest real outcome in every test env, which never configures `AAOS_API_BASE_URL`/`AAOS_API_KEY`). */
export function buildLearningBridgeStatus(
  overrides: Partial<LearningBridgeStatusDto> = {},
): LearningBridgeStatusDto {
  return {
    status: "SKIPPED",
    reason: "AAOS_API_BASE_URL/AAOS_API_KEY belum dikonfigurasi di aaos-simulator.",
    ...overrides,
  } as LearningBridgeStatusDto;
}

export function buildPromptOverrideStatus(
  overrides: Partial<PromptOverrideStatusDto> = {},
): PromptOverrideStatusDto {
  return {
    applied: false,
    tenantId: "tenant-dss-motor",
    reason: "AAOS_API_BASE_URL/AAOS_API_KEY belum dikonfigurasi di aaos-simulator.",
    ...overrides,
  } as PromptOverrideStatusDto;
}

export function buildSimulateAllResponse(
  overrides: Partial<SimulateAllResponse> = {},
): SimulateAllResponse {
  return {
    results: [],
    report: buildAllScenariosReport(),
    learningBridge: buildLearningBridgeStatus(),
    promptOverride: buildPromptOverrideStatus(),
    ...overrides,
  };
}
