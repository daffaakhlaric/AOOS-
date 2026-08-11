import { err, ok, ErrorCode } from "@aos/common";
import { EventCategory } from "@aos/event-bus";
import { ConversationStage, LeadTemperature } from "@aos/sales-agent";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { JessySimulationComposer } from "../../../../src/application/services/JessySimulationComposer.js";
import { ObservablePublisher } from "../../../../src/application/services/ObservablePublisher.js";
import { SimulationRunnerService } from "../../../../src/application/services/SimulationRunnerService.js";
import { SimulatorError } from "../../../../src/domain/errors/SimulatorError.js";
import { PersonaId } from "../../../../src/domain/value-objects/PersonaId.js";
import { SimulationStatus } from "../../../../src/domain/value-objects/SimulationStatus.js";
import { GhostBuyer } from "../../../../src/personas/GhostBuyer.js";
import { ReadyBuyer } from "../../../../src/personas/ReadyBuyer.js";
import { makeSimulatorConfig } from "../../../fixtures/simulatorFixtures.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

function fakeConversation(
  stage: ConversationStage,
  score: number,
): { stage: ConversationStage; score: { toNumber: () => number } } {
  return { stage, score: { toNumber: () => score } };
}

function fakeEvents(): {
  publishSimulationStarted: ReturnType<typeof vi.fn>;
  publishTurnCompleted: ReturnType<typeof vi.fn>;
  publishHandoffReached: ReturnType<typeof vi.fn>;
  publishSimulationCompleted: ReturnType<typeof vi.fn>;
  publishSimulationFailed: ReturnType<typeof vi.fn>;
} {
  return {
    publishSimulationStarted: vi.fn().mockResolvedValue(undefined),
    publishTurnCompleted: vi.fn().mockResolvedValue(undefined),
    publishHandoffReached: vi.fn().mockResolvedValue(undefined),
    publishSimulationCompleted: vi.fn().mockResolvedValue(undefined),
    publishSimulationFailed: vi.fn().mockResolvedValue(undefined),
  };
}

function fakeRegistry(persona: typeof ReadyBuyer): { get: ReturnType<typeof vi.fn> } {
  return { get: vi.fn().mockReturnValue(ok(persona)) };
}

const NOW = new Date("2026-08-10T09:00:00.000Z");

describe("SimulationRunnerService", () => {
  let publisher: ObservablePublisher;

  beforeEach(() => {
    publisher = new ObservablePublisher();
  });

  function fakeComposer(agentOverrides: {
    processIncomingMessage: { execute: ReturnType<typeof vi.fn> };
    followUpService?: { applyNoReplyPenaltyIfStale: ReturnType<typeof vi.fn> };
  }): JessySimulationComposer {
    const clock = { current: NOW };
    return {
      compose: vi.fn().mockResolvedValue(
        ok({
          agent: {
            processIncomingMessage: agentOverrides.processIncomingMessage,
            followUpService: agentOverrides.followUpService ?? {
              applyNoReplyPenaltyIfStale: vi.fn(),
            },
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

  it("ends COMPLETED the instant handoff fires, even with script lines remaining", async () => {
    const execute = vi.fn().mockResolvedValue(
      ok({
        conversation: fakeConversation(ConversationStage.HANDOFF, 80),
        outgoingMessage: { body: "Mantap kak!" },
        temperature: LeadTemperature.HOT,
        becameHot: true,
        handoff: { salesName: "Sales Cinere" },
      }),
    );
    const registry = fakeRegistry(ReadyBuyer);
    const strategy = { nextMessage: vi.fn().mockReturnValue("halo kak mau beli Xpander") };
    const events = fakeEvents();
    const runner = new SimulationRunnerService(
      registry as never,
      strategy as never,
      events as never,
      fakeComposer({ processIncomingMessage: { execute } }),
    );

    const result = unwrap(await runner.runSimulation(PersonaId.READY_BUYER, makeSimulatorConfig()));

    expect(result.status).toBe(SimulationStatus.COMPLETED);
    expect(result.handoffTriggered).toBe(true);
    expect(result.handoffAtTurn).toBe(1);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(events.publishHandoffReached).toHaveBeenCalledTimes(1);
  });

  it("ends COMPLETED when the persona's script is exhausted with no handoff", async () => {
    const execute = vi.fn().mockResolvedValue(
      ok({
        conversation: fakeConversation(ConversationStage.GREETING, 0),
        outgoingMessage: { body: "Halo kak!" },
        temperature: LeadTemperature.COLD,
        becameHot: false,
        handoff: undefined,
      }),
    );
    const persona = { ...GhostBuyer, testFollowUp: false, script: ["halo min"] };
    const registry = fakeRegistry(persona as never);
    const strategy = {
      nextMessage: vi.fn().mockReturnValueOnce("halo min").mockReturnValue(undefined),
    };
    const events = fakeEvents();
    const runner = new SimulationRunnerService(
      registry as never,
      strategy as never,
      events as never,
      fakeComposer({ processIncomingMessage: { execute } }),
    );

    const result = unwrap(await runner.runSimulation(PersonaId.GHOST_BUYER, makeSimulatorConfig()));

    expect(result.status).toBe(SimulationStatus.COMPLETED);
    expect(result.handoffTriggered).toBe(false);
  });

  it("ends TIMEOUT when maxTurnsPerSimulation is reached without handoff or exhaustion", async () => {
    const execute = vi.fn().mockResolvedValue(
      ok({
        conversation: fakeConversation(ConversationStage.DISCOVERY, 10),
        outgoingMessage: { body: "oke kak" },
        temperature: LeadTemperature.COLD,
        becameHot: false,
        handoff: undefined,
      }),
    );
    const registry = fakeRegistry(ReadyBuyer);
    const strategy = { nextMessage: vi.fn().mockReturnValue("terus ngobrol") };
    const events = fakeEvents();
    const runner = new SimulationRunnerService(
      registry as never,
      strategy as never,
      events as never,
      fakeComposer({ processIncomingMessage: { execute } }),
    );

    const result = unwrap(
      await runner.runSimulation(
        PersonaId.READY_BUYER,
        makeSimulatorConfig({ maxTurnsPerSimulation: 3 }),
      ),
    );

    expect(result.status).toBe(SimulationStatus.TIMEOUT);
    expect(result.totalTurns).toBe(3);
    expect(execute).toHaveBeenCalledTimes(3);
  });

  it("returns err when Jessy's own use case returns an err Result mid-turn", async () => {
    const execute = vi
      .fn()
      .mockResolvedValue(err(new SimulatorError(ErrorCode.INTERNAL, "jessy exploded")));
    const registry = fakeRegistry(ReadyBuyer);
    const strategy = { nextMessage: vi.fn().mockReturnValue("halo") };
    const events = fakeEvents();
    const runner = new SimulationRunnerService(
      registry as never,
      strategy as never,
      events as never,
      fakeComposer({ processIncomingMessage: { execute } }),
    );

    const error = unwrapErr(
      await runner.runSimulation(PersonaId.READY_BUYER, makeSimulatorConfig()),
    );
    expect(error).toBeInstanceOf(SimulatorError);
    expect(events.publishSimulationFailed).toHaveBeenCalledTimes(1);
  });

  it("returns err (never throws) when the turn loop throws unexpectedly", async () => {
    const execute = vi.fn().mockRejectedValue(new Error("network blew up"));
    const registry = fakeRegistry(ReadyBuyer);
    const strategy = { nextMessage: vi.fn().mockReturnValue("halo") };
    const events = fakeEvents();
    const runner = new SimulationRunnerService(
      registry as never,
      strategy as never,
      events as never,
      fakeComposer({ processIncomingMessage: { execute } }),
    );

    const error = unwrapErr(
      await runner.runSimulation(PersonaId.READY_BUYER, makeSimulatorConfig()),
    );
    expect(error.message).toContain("network blew up");
  });

  it("returns err (never throws) when the turn loop rejects with a non-Error value", async () => {
    const execute = vi.fn().mockRejectedValue("just a string, not an Error");
    const registry = fakeRegistry(ReadyBuyer);
    const strategy = { nextMessage: vi.fn().mockReturnValue("halo") };
    const events = fakeEvents();
    const runner = new SimulationRunnerService(
      registry as never,
      strategy as never,
      events as never,
      fakeComposer({ processIncomingMessage: { execute } }),
    );

    const error = unwrapErr(
      await runner.runSimulation(PersonaId.READY_BUYER, makeSimulatorConfig()),
    );
    expect(error.message).toContain("just a string, not an Error");
  });

  it("returns err when the persona id isn't registered", async () => {
    const registry = {
      get: vi.fn().mockReturnValue(err(new SimulatorError(ErrorCode.NOT_FOUND, "nope"))),
    };
    const strategy = { nextMessage: vi.fn() };
    const events = fakeEvents();
    const runner = new SimulationRunnerService(
      registry as never,
      strategy as never,
      events as never,
      fakeComposer({ processIncomingMessage: { execute: vi.fn() } }),
    );

    const error = unwrapErr(
      await runner.runSimulation(PersonaId.READY_BUYER, makeSimulatorConfig()),
    );
    expect(error.message).toBe("nope");
  });

  it("returns err when composing the Jessy agent fails", async () => {
    const registry = fakeRegistry(ReadyBuyer);
    const strategy = { nextMessage: vi.fn() };
    const events = fakeEvents();
    const composer = {
      compose: vi
        .fn()
        .mockResolvedValue(err(new SimulatorError(ErrorCode.INTERNAL, "compose failed"))),
    } as unknown as JessySimulationComposer;
    const runner = new SimulationRunnerService(
      registry as never,
      strategy as never,
      events as never,
      composer,
    );

    const error = unwrapErr(
      await runner.runSimulation(PersonaId.READY_BUYER, makeSimulatorConfig()),
    );
    expect(error.message).toBe("compose failed");
  });

  it("runs the no-reply timeout phase for testFollowUp personas once the script is exhausted, recording a NO_REPLY_TIMEOUT entry", async () => {
    const execute = vi.fn().mockResolvedValue(
      ok({
        conversation: fakeConversation(ConversationStage.GREETING, 0),
        outgoingMessage: { body: "Halo kak!" },
        temperature: LeadTemperature.COLD,
        becameHot: false,
        handoff: undefined,
      }),
    );
    const applyNoReplyPenaltyIfStale = vi.fn().mockReturnValue({ toNumber: () => -10 });
    const registry = fakeRegistry(GhostBuyer);
    const strategy = {
      nextMessage: vi.fn().mockReturnValueOnce("halo min").mockReturnValue(undefined),
    };
    const events = fakeEvents();
    const runner = new SimulationRunnerService(
      registry as never,
      strategy as never,
      events as never,
      fakeComposer({
        processIncomingMessage: { execute },
        followUpService: { applyNoReplyPenaltyIfStale },
      }),
    );

    const result = unwrap(await runner.runSimulation(PersonaId.GHOST_BUYER, makeSimulatorConfig()));

    expect(applyNoReplyPenaltyIfStale).toHaveBeenCalledTimes(1);
    expect(result.scoreProgression.some((e) => e.reason === "NO_REPLY_TIMEOUT")).toBe(true);
    expect(result.finalScore).toBe(-10);
  });

  it("skips the no-reply scoreProgression entry when the penalty causes no delta", async () => {
    const execute = vi.fn().mockResolvedValue(
      ok({
        conversation: fakeConversation(ConversationStage.GREETING, 0),
        outgoingMessage: { body: "Halo kak!" },
        temperature: LeadTemperature.COLD,
        becameHot: false,
        handoff: undefined,
      }),
    );
    const applyNoReplyPenaltyIfStale = vi.fn().mockReturnValue({ toNumber: () => 0 });
    const registry = fakeRegistry(GhostBuyer);
    const strategy = {
      nextMessage: vi.fn().mockReturnValueOnce("halo min").mockReturnValue(undefined),
    };
    const events = fakeEvents();
    const runner = new SimulationRunnerService(
      registry as never,
      strategy as never,
      events as never,
      fakeComposer({
        processIncomingMessage: { execute },
        followUpService: { applyNoReplyPenaltyIfStale },
      }),
    );

    const result = unwrap(await runner.runSimulation(PersonaId.GHOST_BUYER, makeSimulatorConfig()));
    expect(result.scoreProgression.some((e) => e.reason === "NO_REPLY_TIMEOUT")).toBe(false);
  });

  it("records score-updated and follow-up-scheduled events observed on the publisher during a turn", async () => {
    const execute = vi.fn().mockImplementation(async () => {
      await publisher.publish({
        type: "aaos.sales.lead.score-updated",
        category: EventCategory.DOMAIN,
        payload: { newScore: 25, delta: 25, criterion: "BUDGET" },
        source: "@aos/sales-agent",
        producer: "@aos/sales-agent",
        tenantId: "tenant-x",
        correlationId: "corr-1",
        version: "1.0.0",
      });
      await publisher.publish({
        type: "aaos.sales.follow-up.scheduled",
        category: EventCategory.DOMAIN,
        payload: {},
        source: "@aos/sales-agent",
        producer: "@aos/sales-agent",
        tenantId: "tenant-x",
        correlationId: "corr-1",
        version: "1.0.0",
      });
      return ok({
        conversation: fakeConversation(ConversationStage.DISCOVERY, 25),
        outgoingMessage: { body: "budget kamu berapa kak?" },
        temperature: LeadTemperature.COLD,
        becameHot: false,
        handoff: undefined,
      });
    });
    const registry = fakeRegistry(ReadyBuyer);
    const strategy = {
      nextMessage: vi.fn().mockReturnValueOnce("budget 100 juta").mockReturnValue(undefined),
    };
    const events = fakeEvents();
    const runner = new SimulationRunnerService(
      registry as never,
      strategy as never,
      events as never,
      fakeComposer({ processIncomingMessage: { execute } }),
    );

    const result = unwrap(await runner.runSimulation(PersonaId.READY_BUYER, makeSimulatorConfig()));

    expect(result.scoreProgression).toEqual([{ turn: 1, score: 25, delta: 25, reason: "BUDGET" }]);
    expect(result.followUpScheduled).toBe(true);
    expect(result.stageTransitions).toEqual([
      { turn: 1, from: ConversationStage.GREETING, to: ConversationStage.DISCOVERY },
    ]);
  });

  it("honors delayBetweenTurnsMs by waiting between turns (config.delayBetweenTurnsMs)", async () => {
    const execute = vi.fn().mockResolvedValue(
      ok({
        conversation: fakeConversation(ConversationStage.DISCOVERY, 10),
        outgoingMessage: { body: "oke kak" },
        temperature: LeadTemperature.COLD,
        becameHot: false,
        handoff: undefined,
      }),
    );
    const registry = fakeRegistry(ReadyBuyer);
    const strategy = { nextMessage: vi.fn().mockReturnValue("terus ngobrol") };
    const events = fakeEvents();
    const runner = new SimulationRunnerService(
      registry as never,
      strategy as never,
      events as never,
      fakeComposer({ processIncomingMessage: { execute } }),
    );

    const start = Date.now();
    await runner.runSimulation(
      PersonaId.READY_BUYER,
      makeSimulatorConfig({ maxTurnsPerSimulation: 2, delayBetweenTurnsMs: 30 }),
    );
    expect(Date.now() - start).toBeGreaterThanOrEqual(25);
  });

  it("getResult() looks up a previously completed session by id, and errors for an unknown one", async () => {
    const execute = vi.fn().mockResolvedValue(
      ok({
        conversation: fakeConversation(ConversationStage.GREETING, 0),
        outgoingMessage: { body: "Halo kak!" },
        temperature: LeadTemperature.COLD,
        becameHot: false,
        handoff: undefined,
      }),
    );
    const registry = fakeRegistry(ReadyBuyer);
    const strategy = {
      nextMessage: vi.fn().mockReturnValueOnce("halo").mockReturnValue(undefined),
    };
    const events = fakeEvents();
    const runner = new SimulationRunnerService(
      registry as never,
      strategy as never,
      events as never,
      fakeComposer({ processIncomingMessage: { execute } }),
    );

    const result = unwrap(await runner.runSimulation(PersonaId.READY_BUYER, makeSimulatorConfig()));
    const found = unwrap(runner.getResult(result.sessionId.toString()));
    expect(found).toBe(result);

    const missing = unwrapErr(runner.getResult("does-not-exist"));
    expect(missing.message).toContain("does-not-exist");
  });
});
