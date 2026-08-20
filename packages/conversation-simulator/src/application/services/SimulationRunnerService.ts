import { err, ErrorCode, ok, type Result } from "@aos/common";
import { ConversationStage, type LeadConversation } from "@aos/sales-agent";

import { SimulationResultBuilder } from "../../builders/SimulationResultBuilder.js";
import { SimulationSessionBuilder } from "../../builders/SimulationSessionBuilder.js";
import type { SimulatorConfig } from "../../config/SimulatorConfig.js";
import type { IPersonaStrategy } from "../../contracts/IPersonaStrategy.js";
import type { ISimulationRunner } from "../../contracts/ISimulationRunner.js";
import type { BuyerPersona } from "../../domain/entities/BuyerPersona.js";
import { SimulationSpeaker } from "../../domain/entities/SimulationMessage.js";
import type { SimulationResult } from "../../domain/entities/SimulationResult.js";
import type { SimulationSession } from "../../domain/entities/SimulationSession.js";
import { SimulatorError } from "../../domain/errors/SimulatorError.js";
import type { SimulatorEvents } from "../../domain/events/SimulatorEvents.js";
import type { PersonaId } from "../../domain/value-objects/PersonaId.js";
import { SimulationStatus } from "../../domain/value-objects/SimulationStatus.js";
import type { PersonaRegistry } from "../../registry/PersonaRegistry.js";

import type { JessySimulationComposition } from "./JessySimulationComposer.js";
import { JessySimulationComposer } from "./JessySimulationComposer.js";

interface ScoreUpdatedPayload {
  readonly newScore: number;
  readonly delta: number;
  readonly criterion: string;
}

interface TurnLoopOutcome {
  readonly session: SimulationSession;
  readonly failed: boolean;
}

/**
 * The simulation engine (spec "Simulation Engine"). Runs one persona's script turn-by-turn
 * against a freshly-composed real `@aos/sales-agent` `JessyAgent`, recording every message, score
 * change, and stage transition, and applying the 4 end-condition rules in strict priority order
 * (design resolution #2): (a) `HandoffTriggered` on the current turn ends the run as `COMPLETED`
 * immediately, even with script lines remaining; (b) script exhaustion with no handoff →
 * `COMPLETED`; (c) `maxTurnsPerSimulation` reached → `TIMEOUT`; (d) any thrown/unexpected error,
 * or an `err` Result from Jessy's own use case, is caught and returned via this method's own
 * `Result` err channel — never thrown out of `runSimulation`.
 */
export class SimulationRunnerService implements ISimulationRunner {
  private readonly resultsBySessionId = new Map<string, SimulationResult>();

  constructor(
    private readonly personaRegistry: PersonaRegistry,
    private readonly personaStrategy: IPersonaStrategy,
    private readonly events: SimulatorEvents,
    private readonly composer: JessySimulationComposer = new JessySimulationComposer(),
  ) {}

  getResult(sessionId: string): Result<SimulationResult, SimulatorError> {
    const found = this.resultsBySessionId.get(sessionId);
    if (found === undefined) {
      return err(
        new SimulatorError(
          ErrorCode.NOT_FOUND,
          `No simulation result found for session "${sessionId}"`,
        ),
      );
    }
    return ok(found);
  }

  async runSimulation(
    personaId: PersonaId,
    config: SimulatorConfig,
  ): Promise<Result<SimulationResult, SimulatorError>> {
    const personaResult = this.personaRegistry.get(personaId);
    if (!personaResult.ok) {
      return err(personaResult.error);
    }
    const persona = personaResult.value;

    const compositionResult = await this.composer.compose(config);
    if (!compositionResult.ok) {
      return err(compositionResult.error);
    }
    const composition = compositionResult.value;

    const wallClockStartMs = Date.now();
    let session = SimulationSessionBuilder.start(
      personaId,
      persona.difficulty,
      composition.clock.current,
    );
    const correlationId = `${session.id.toString()}-corr`;

    await this.events.publishSimulationStarted({
      sessionId: session.id.toString(),
      personaId,
      branchId: config.branchId,
      tenantId: config.tenantId,
      correlationId,
      occurredAt: composition.clock.current,
      version: "1.0",
    });

    let loopOutcome: TurnLoopOutcome;
    try {
      loopOutcome = await this.runTurnLoop(session, persona, composition, config, correlationId);
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause);
      await this.events.publishSimulationFailed({
        sessionId: session.id.toString(),
        personaId,
        turn: session.turnCount.toNumber(),
        reason,
        tenantId: config.tenantId,
        correlationId,
        occurredAt: composition.clock.current,
        version: "1.0",
      });
      return err(
        new SimulatorError(ErrorCode.INTERNAL, `Simulation threw unexpectedly: ${reason}`, {
          cause,
        }),
      );
    }

    session = loopOutcome.session;
    if (loopOutcome.failed) {
      return err(
        new SimulatorError(
          ErrorCode.INTERNAL,
          "Jessy's use case returned an unexpected error mid-simulation",
        ),
      );
    }

    const durationMs = Math.max(0, Date.now() - wallClockStartMs);
    const result = SimulationResultBuilder.build(
      session,
      persona,
      durationMs,
      session.currentScore,
      session.currentTemperature,
    );
    this.resultsBySessionId.set(session.id.toString(), result);

    await this.events.publishSimulationCompleted({
      sessionId: session.id.toString(),
      personaId,
      status: result.status,
      totalTurns: result.totalTurns,
      finalScore: result.finalScore,
      finalTemperature: result.finalTemperature,
      metExpectation: result.metExpectation,
      tenantId: config.tenantId,
      correlationId,
      occurredAt: composition.clock.current,
      version: "1.0",
    });

    return ok(result);
  }

  private async runTurnLoop(
    initialSession: SimulationSession,
    persona: BuyerPersona,
    composition: JessySimulationComposition,
    config: SimulatorConfig,
    correlationId: string,
  ): Promise<TurnLoopOutcome> {
    let session = initialSession;
    let lastConversation: LeadConversation | undefined;
    const { agent, publisher, inventorySpy, listingSpy, clock } = composition;

    for (let turn = 1; turn <= config.maxTurnsPerSimulation; turn += 1) {
      const messageText = this.personaStrategy.nextMessage(persona, turn - 1);

      if (messageText === undefined) {
        if (persona.testFollowUp === true && lastConversation !== undefined) {
          session = this.runNoReplyTimeoutPhase(session, composition, turn, lastConversation);
        }
        return { session: session.withStatus(SimulationStatus.COMPLETED), failed: false };
      }

      session = session
        .withAppendedMessage({
          turn,
          speaker: SimulationSpeaker.BUYER,
          text: messageText,
          occurredAt: clock.current,
        })
        .withIncrementedTurn();

      const eventsBefore = publisher.published.length;
      const outcome = await agent.processIncomingMessage.execute({
        leadPhone: "+62811900000",
        branchId: config.branchId,
        messageText,
        tenantId: config.tenantId,
        correlationId,
      });

      if (!outcome.ok) {
        await this.events.publishSimulationFailed({
          sessionId: session.id.toString(),
          personaId: session.personaId,
          turn,
          reason: outcome.error.message,
          tenantId: config.tenantId,
          correlationId,
          occurredAt: clock.current,
          version: "1.0",
        });
        return { session: session.withStatus(SimulationStatus.FAILED), failed: true };
      }

      const { conversation, outgoingMessage, temperature, becameHot, handoff } = outcome.value;
      lastConversation = conversation;

      session = session.withAppendedMessage({
        turn,
        speaker: SimulationSpeaker.JESSY,
        text: outgoingMessage.body.toString(),
        occurredAt: clock.current,
      });

      /**
       * AAOS-W3D Fix 1: when a message pushes the score past `hotThreshold` this same turn,
       * `JessyAgentService.processMessage` immediately overrides the returned `conversation.stage`
       * to `HANDOFF` (right after triggering the real handoff) — so the intermediate `CLOSING`
       * decision `@aos/sales-agent`'s own `StageDetector` made for this turn (its top-priority rule:
       * `score >= hotThreshold` always yields `CLOSING`, unconditionally — see
       * `StageDetector.detect`) would otherwise never show up as its own `stageTransitions` entry,
       * even though Jessy's actual outbound message this turn IS that CLOSING-stage reply (the
       * override only touches the stored `conversation.stage`, never `outgoingMessage`). Recording
       * it explicitly here — before the HANDOFF transition below — reflects what really happened
       * this turn: Jessy attempted a closing push, which immediately succeeded into a handoff.
       * `becameHot` is exactly the signal `JessyAgentService` uses for the same override, so this
       * relies on no invariant beyond the one that override itself already depends on.
       */
      if (becameHot && session.currentStage !== ConversationStage.CLOSING) {
        session = session.withStageTransition({
          turn,
          from: session.currentStage,
          to: ConversationStage.CLOSING,
        });
      }

      if (conversation.stage !== session.currentStage) {
        session = session.withStageTransition({
          turn,
          from: session.currentStage,
          to: conversation.stage,
        });
      }

      for (const published of publisher.since(eventsBefore)) {
        if (published.type === "aaos.sales.lead.score-updated") {
          const payload = published.payload as ScoreUpdatedPayload;
          session = session.withScoreProgressionEntry({
            turn,
            score: payload.newScore,
            delta: payload.delta,
            reason: payload.criterion,
          });
        }
        if (published.type === "aaos.sales.follow-up.scheduled") {
          session = session.withFollowUpScheduled();
        }
      }

      if (inventorySpy?.wasUsedWithResult === true || listingSpy?.wasUsedWithResult === true) {
        session = session.withJessyUsedInventory();
      }

      session = session
        .withCurrentTemperature(temperature)
        .withCurrentScore(conversation.score.toNumber());

      await this.events.publishTurnCompleted({
        sessionId: session.id.toString(),
        personaId: session.personaId,
        turn,
        score: conversation.score.toNumber(),
        tenantId: config.tenantId,
        correlationId,
        occurredAt: clock.current,
        version: "1.0",
      });

      if (handoff !== undefined) {
        session = session.withHandoff(turn).withStatus(SimulationStatus.COMPLETED);
        await this.events.publishHandoffReached({
          sessionId: session.id.toString(),
          personaId: session.personaId,
          turn,
          score: conversation.score.toNumber(),
          tenantId: config.tenantId,
          correlationId,
          occurredAt: clock.current,
          version: "1.0",
        });
        return { session, failed: false };
      }

      if (turn === config.maxTurnsPerSimulation) {
        return { session: session.withStatus(SimulationStatus.TIMEOUT), failed: false };
      }

      if (config.delayBetweenTurnsMs > 0) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, config.delayBetweenTurnsMs);
        });
      }
    }

    /* v8 ignore start -- unreachable: `SimulatorConfigSchema.maxTurnsPerSimulation` is validated
       positive (>= 1) at parse time, so the loop above always executes at least one iteration and
       always returns from inside it (script-exhausted, handoff, Jessy error, or the
       `turn === config.maxTurnsPerSimulation` check on its final iteration) — this line exists
       only to satisfy TypeScript's control-flow analysis for a function that must return. */
    return { session: session.withStatus(SimulationStatus.TIMEOUT), failed: false };
    /* v8 ignore stop */
  }

  /**
   * Design resolution #3: after `GhostBuyer`'s script goes silent, exercise
   * `@aos/sales-agent`'s real injectable-clock no-reply mechanism directly — advance the
   * simulator-owned `SimulationClock` past `SalesAgentConfig.noReplyTimeoutMs`, then call
   * `FollowUpService.applyNoReplyPenaltyIfStale` (the exact method `@aos/sales-agent`'s own unit
   * test exercises) on the last real `LeadConversation` this session produced, so the -10
   * `NO_REPLY` penalty is actually applied and recorded here as a `scoreProgression` entry, rather
   * than left as untested dead code in this package. `followUpScheduled` itself is already `true`
   * by this point for any COLD/WARM persona (`JessyAgentService.processMessage`'s normal
   * COLD/WARM branch schedules + emits `FollowUpScheduled` on every such turn); this phase's job
   * is purely to exercise the *timeout* seam, not to (re)trigger scheduling.
   */
  private runNoReplyTimeoutPhase(
    session: SimulationSession,
    composition: JessySimulationComposition,
    nextTurn: number,
    conversation: LeadConversation,
  ): SimulationSession {
    const { clock, salesAgentConfig, agent } = composition;
    clock.current = new Date(clock.current.getTime() + salesAgentConfig.noReplyTimeoutMs + 1);

    const staleScore = agent.followUpService.applyNoReplyPenaltyIfStale(conversation);
    const newScore = staleScore.toNumber();
    const delta = newScore - session.currentScore;
    if (delta === 0) {
      return session;
    }
    return session.withScoreProgressionEntry({
      turn: nextTurn,
      score: newScore,
      delta,
      reason: "NO_REPLY_TIMEOUT",
    });
  }
}
