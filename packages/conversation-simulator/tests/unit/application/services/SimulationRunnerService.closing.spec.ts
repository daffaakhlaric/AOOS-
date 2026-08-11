import { ok } from "@aos/common";
import { ConversationStage, LeadTemperature } from "@aos/sales-agent";
import { describe, expect, it, vi } from "vitest";

import type { JessySimulationComposer } from "../../../../src/application/services/JessySimulationComposer.js";
import { ObservablePublisher } from "../../../../src/application/services/ObservablePublisher.js";
import { SimulationRunnerService } from "../../../../src/application/services/SimulationRunnerService.js";
import { PersonaId } from "../../../../src/domain/value-objects/PersonaId.js";
import { ReadyBuyer } from "../../../../src/personas/ReadyBuyer.js";
import { makeSimulatorConfig } from "../../../fixtures/simulatorFixtures.js";
import { unwrap } from "../../../helpers/result.js";

/**
 * AAOS-W3D Fix 1: covers the same-turn CLOSING→HANDOFF transition-recording addition to
 * `SimulationRunnerService`'s turn loop — see its doc comment for the full architectural
 * reasoning (`JessyAgentService.processMessage` overrides `conversation.stage` straight to
 * `HANDOFF` the instant `becameHot` fires, which would otherwise hide the intermediate `CLOSING`
 * decision `StageDetector`'s top-priority HOT rule always makes on that same turn).
 */
const NOW = new Date("2026-08-10T09:00:00.000Z");

function fakeConversation(
  stage: ConversationStage,
  score: number,
): { stage: ConversationStage; score: { toNumber: () => number } } {
  return { stage, score: { toNumber: () => score } };
}

function fakeComposer(
  agentOverrides: {
    processIncomingMessage: { execute: ReturnType<typeof vi.fn> };
  },
  publisher: ObservablePublisher,
): JessySimulationComposer {
  const clock = { current: NOW };
  return {
    compose: vi.fn().mockResolvedValue(
      ok({
        agent: {
          processIncomingMessage: agentOverrides.processIncomingMessage,
          followUpService: { applyNoReplyPenaltyIfStale: vi.fn() },
        },
        publisher,
        inventorySpy: { wasUsedWithResult: false },
        clock,
        salesAgentConfig: {
          tenantId: "tenant-x",
          agentName: "Jessy",
          language: "id",
          hotThreshold: 65,
          warmThreshold: 31,
          noReplyTimeoutMs: 21_600_000,
          minResponseDelayMs: 800,
          maxResponseDelayMs: 3000,
          followUpEnabled: true,
          followUpDays: [3, 7, 14],
        },
      }),
    ),
  } as unknown as JessySimulationComposer;
}

function fakeRegistry(): { get: ReturnType<typeof vi.fn> } {
  return { get: vi.fn().mockReturnValue(ok(ReadyBuyer)) };
}

function fakeEvents(): Record<string, ReturnType<typeof vi.fn>> {
  return {
    publishSimulationStarted: vi.fn().mockResolvedValue(undefined),
    publishTurnCompleted: vi.fn().mockResolvedValue(undefined),
    publishHandoffReached: vi.fn().mockResolvedValue(undefined),
    publishSimulationCompleted: vi.fn().mockResolvedValue(undefined),
    publishSimulationFailed: vi.fn().mockResolvedValue(undefined),
  };
}

describe("SimulationRunnerService — same-turn CLOSING recording (AAOS-W3D Fix 1)", () => {
  it("becameHot=true on turn 1, prior stage GREETING → records a CLOSING transition BEFORE the HANDOFF transition, same turn", async () => {
    const publisher = new ObservablePublisher();
    const execute = vi.fn().mockResolvedValue(
      ok({
        conversation: fakeConversation(ConversationStage.HANDOFF, 80),
        outgoingMessage: { body: "Mau jadwalin test drive kak?" },
        temperature: LeadTemperature.HOT,
        becameHot: true,
        handoff: { salesName: "Sales Cinere" },
      }),
    );
    const runner = new SimulationRunnerService(
      fakeRegistry() as never,
      { nextMessage: vi.fn().mockReturnValue("halo kak mau beli Xpander") } as never,
      fakeEvents() as never,
      fakeComposer({ processIncomingMessage: { execute } }, publisher),
    );

    const result = unwrap(await runner.runSimulation(PersonaId.READY_BUYER, makeSimulatorConfig()));

    expect(result.stageTransitions).toEqual([
      { turn: 1, from: ConversationStage.GREETING, to: ConversationStage.CLOSING },
      { turn: 1, from: ConversationStage.CLOSING, to: ConversationStage.HANDOFF },
    ]);
  });

  it("becameHot=false → no synthetic CLOSING transition is inserted", async () => {
    const publisher = new ObservablePublisher();
    const execute = vi.fn().mockResolvedValue(
      ok({
        conversation: fakeConversation(ConversationStage.DISCOVERY, 10),
        outgoingMessage: { body: "oke kak" },
        temperature: LeadTemperature.COLD,
        becameHot: false,
        handoff: undefined,
      }),
    );
    const runner = new SimulationRunnerService(
      fakeRegistry() as never,
      { nextMessage: vi.fn().mockReturnValueOnce("halo kak").mockReturnValue(undefined) } as never,
      fakeEvents() as never,
      fakeComposer({ processIncomingMessage: { execute } }, publisher),
    );

    const result = unwrap(await runner.runSimulation(PersonaId.READY_BUYER, makeSimulatorConfig()));

    expect(result.stageTransitions).toEqual([
      { turn: 1, from: ConversationStage.GREETING, to: ConversationStage.DISCOVERY },
    ]);
  });

  it("becameHot=true but the conversation stage returned is already CLOSING (not HANDOFF) → only one transition is recorded, no duplicate", async () => {
    const publisher = new ObservablePublisher();
    const execute = vi.fn().mockResolvedValue(
      ok({
        conversation: fakeConversation(ConversationStage.CLOSING, 70),
        outgoingMessage: { body: "Mau survey unitnya kak?" },
        temperature: LeadTemperature.HOT,
        becameHot: true,
        handoff: undefined,
      }),
    );
    const runner = new SimulationRunnerService(
      fakeRegistry() as never,
      { nextMessage: vi.fn().mockReturnValueOnce("halo kak").mockReturnValue(undefined) } as never,
      fakeEvents() as never,
      fakeComposer({ processIncomingMessage: { execute } }, publisher),
    );

    const result = unwrap(await runner.runSimulation(PersonaId.READY_BUYER, makeSimulatorConfig()));

    expect(result.stageTransitions).toEqual([
      { turn: 1, from: ConversationStage.GREETING, to: ConversationStage.CLOSING },
    ]);
  });

  it("becameHot=true on a LATER turn (session.currentStage already CLOSING from an earlier turn) → no duplicate synthetic transition", async () => {
    const publisher = new ObservablePublisher();
    const execute = vi
      .fn()
      .mockResolvedValueOnce(
        ok({
          conversation: fakeConversation(ConversationStage.CLOSING, 50),
          outgoingMessage: { body: "Mau survey unitnya kak?" },
          temperature: LeadTemperature.WARM,
          becameHot: false,
          handoff: undefined,
        }),
      )
      .mockResolvedValueOnce(
        ok({
          conversation: fakeConversation(ConversationStage.HANDOFF, 80),
          outgoingMessage: { body: "Jessy sambungin ke tim ya kak" },
          temperature: LeadTemperature.HOT,
          becameHot: true,
          handoff: { salesName: "Sales Cinere" },
        }),
      );
    const runner = new SimulationRunnerService(
      fakeRegistry() as never,
      {
        nextMessage: vi
          .fn()
          .mockReturnValueOnce("halo kak")
          .mockReturnValueOnce("oke lanjut kak")
          .mockReturnValue(undefined),
      } as never,
      fakeEvents() as never,
      fakeComposer({ processIncomingMessage: { execute } }, publisher),
    );

    const result = unwrap(await runner.runSimulation(PersonaId.READY_BUYER, makeSimulatorConfig()));

    expect(result.stageTransitions).toEqual([
      { turn: 1, from: ConversationStage.GREETING, to: ConversationStage.CLOSING },
      { turn: 2, from: ConversationStage.CLOSING, to: ConversationStage.HANDOFF },
    ]);
  });
});
