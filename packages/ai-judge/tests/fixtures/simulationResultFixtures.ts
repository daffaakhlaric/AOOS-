import {
  PersonaDifficulty,
  PersonaId,
  SessionId,
  SimulationStatus,
  type SimulationMessage,
  type SimulationResult,
} from "@aos/conversation-simulator";
import { LeadTemperature } from "@aos/sales-agent";

type Speaker = SimulationMessage["speaker"];
export const CLARA: Speaker = "CLARA" as Speaker;
export const BUYER: Speaker = "BUYER" as Speaker;

let sessionSequence = 0;

/** One `SimulationMessage` fixture, defaulting `occurredAt` to a fixed deterministic instant offset by `turn`. */
export function makeMessage(turn: number, speaker: Speaker, text: string): SimulationMessage {
  return { turn, speaker, text, occurredAt: new Date(2026, 0, 1, 10, 0, turn) };
}

/**
 * A fully-defaulted `SimulationResult` fixture — a short, high-scoring "happy path" conversation
 * by default (concise casual Clara replies, all 4 qualification flags, no objection, closing +
 * handoff both present and well-timed) so most scorer tests only need to override 1-2 fields to
 * isolate the rule under test.
 */
export function makeSimulationResult(overrides: Partial<SimulationResult> = {}): SimulationResult {
  sessionSequence += 1;
  const defaults: SimulationResult = {
    sessionId: SessionId.create(`sim-fixture-${sessionSequence}`),
    personaId: PersonaId.READY_BUYER,
    personaDifficulty: PersonaDifficulty.EASY,
    status: SimulationStatus.COMPLETED,
    messages: [
      makeMessage(1, CLARA, "Halo kak, mau tanya-tanya soal mobil apa nih? 😊"),
      makeMessage(1, BUYER, "mau xpander kak, budget 250 juta, mau kredit, di bintaro"),
      makeMessage(2, CLARA, "Oke kak, xpander ready nih di Bintaro 👍"),
    ],
    totalTurns: 2,
    durationMs: 5_000,
    finalScore: 70,
    finalTemperature: LeadTemperature.WARM,
    handoffTriggered: false,
    handoffAtTurn: undefined,
    scoreProgression: [
      { turn: 1, score: 100, delta: 25, reason: "BUDGET" },
      { turn: 1, score: 100, delta: 25, reason: "UNIT" },
      { turn: 1, score: 100, delta: 25, reason: "AREA" },
      { turn: 1, score: 100, delta: 25, reason: "PAYMENT" },
    ],
    stageTransitions: [],
    finalStage: undefined,
    expectedOutcome: LeadTemperature.HOT,
    metExpectation: false,
    avgClaraResponseLength: 40,
    maxClaraResponseLength: 45,
    longestClaraMessage: "Oke kak, xpander ready nih di Bintaro 👍",
    claraUsedInventory: true,
    claraHandledObjection: false,
    followUpScheduled: false,
  };
  return { ...defaults, ...overrides };
}
