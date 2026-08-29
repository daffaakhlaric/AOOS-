import { ConversationStage, LeadTemperature } from "@aos/sales-agent";

import type { PersonaDifficulty } from "../value-objects/PersonaDifficulty.js";
import type { PersonaId } from "../value-objects/PersonaId.js";
import type { SessionId } from "../value-objects/SessionId.js";
import { SimulationStatus } from "../value-objects/SimulationStatus.js";
import { TurnCount } from "../value-objects/TurnCount.js";

import type { SimulationMessage } from "./SimulationMessage.js";

export interface ScoreProgressionEntry {
  readonly turn: number;
  readonly score: number;
  readonly delta: number;
  readonly reason: string;
}

export interface StageTransitionEntry {
  readonly turn: number;
  readonly from: ConversationStage;
  readonly to: ConversationStage;
}

export interface SimulationSessionProps {
  readonly id: SessionId;
  readonly personaId: PersonaId;
  readonly personaDifficulty: PersonaDifficulty;
  readonly status: SimulationStatus;
  readonly messages: ReadonlyArray<SimulationMessage>;
  readonly turnCount: TurnCount;
  readonly startedAtMs: number;
  readonly scoreProgression: ReadonlyArray<ScoreProgressionEntry>;
  readonly stageTransitions: ReadonlyArray<StageTransitionEntry>;
  readonly handoffTriggered: boolean;
  readonly handoffAtTurn?: number;
  readonly followUpScheduled: boolean;
  readonly claraUsedInventory: boolean;
  readonly currentStage: ConversationStage;
  readonly currentTemperature: LeadTemperature;
  readonly currentScore: number;
}

/**
 * One full simulation run's evolving in-memory state (spec "domain/entities/SimulationSession.ts").
 * Immutable — every `with*` method returns a new instance, mirroring `@aos/sales-agent`'s
 * `LeadConversation` convention. `SimulationRunnerService` folds one of these across the turn
 * loop, then `SimulationResultBuilder` turns the final session into the public `SimulationResult`.
 */
export class SimulationSession {
  private constructor(private readonly props: SimulationSessionProps) {}

  static start(
    id: SessionId,
    personaId: PersonaId,
    personaDifficulty: PersonaDifficulty,
    startedAtMs: number,
  ): SimulationSession {
    return new SimulationSession({
      id,
      personaId,
      personaDifficulty,
      status: SimulationStatus.RUNNING,
      messages: [],
      turnCount: TurnCount.zero(),
      startedAtMs,
      scoreProgression: [],
      stageTransitions: [],
      handoffTriggered: false,
      handoffAtTurn: undefined,
      followUpScheduled: false,
      claraUsedInventory: false,
      currentStage: ConversationStage.GREETING,
      currentTemperature: LeadTemperature.COLD,
      currentScore: 0,
    });
  }

  get id(): SessionId {
    return this.props.id;
  }

  get personaId(): PersonaId {
    return this.props.personaId;
  }

  get status(): SimulationStatus {
    return this.props.status;
  }

  get messages(): ReadonlyArray<SimulationMessage> {
    return this.props.messages;
  }

  get turnCount(): TurnCount {
    return this.props.turnCount;
  }

  get startedAtMs(): number {
    return this.props.startedAtMs;
  }

  get scoreProgression(): ReadonlyArray<ScoreProgressionEntry> {
    return this.props.scoreProgression;
  }

  get stageTransitions(): ReadonlyArray<StageTransitionEntry> {
    return this.props.stageTransitions;
  }

  get handoffTriggered(): boolean {
    return this.props.handoffTriggered;
  }

  get handoffAtTurn(): number | undefined {
    return this.props.handoffAtTurn;
  }

  get followUpScheduled(): boolean {
    return this.props.followUpScheduled;
  }

  get claraUsedInventory(): boolean {
    return this.props.claraUsedInventory;
  }

  get currentStage(): ConversationStage {
    return this.props.currentStage;
  }

  get currentTemperature(): LeadTemperature {
    return this.props.currentTemperature;
  }

  get currentScore(): number {
    return this.props.currentScore;
  }

  get personaDifficulty(): PersonaDifficulty {
    return this.props.personaDifficulty;
  }

  withAppendedMessage(message: SimulationMessage): SimulationSession {
    return new SimulationSession({ ...this.props, messages: [...this.props.messages, message] });
  }

  withIncrementedTurn(): SimulationSession {
    return new SimulationSession({ ...this.props, turnCount: this.props.turnCount.increment() });
  }

  withScoreProgressionEntry(entry: ScoreProgressionEntry): SimulationSession {
    return new SimulationSession({
      ...this.props,
      scoreProgression: [...this.props.scoreProgression, entry],
      currentScore: entry.score,
    });
  }

  withStageTransition(entry: StageTransitionEntry): SimulationSession {
    return new SimulationSession({
      ...this.props,
      stageTransitions: [...this.props.stageTransitions, entry],
      currentStage: entry.to,
    });
  }

  withCurrentTemperature(temperature: LeadTemperature): SimulationSession {
    return new SimulationSession({ ...this.props, currentTemperature: temperature });
  }

  withCurrentScore(score: number): SimulationSession {
    return new SimulationSession({ ...this.props, currentScore: score });
  }

  withHandoff(turn: number): SimulationSession {
    return new SimulationSession({ ...this.props, handoffTriggered: true, handoffAtTurn: turn });
  }

  withFollowUpScheduled(): SimulationSession {
    return new SimulationSession({ ...this.props, followUpScheduled: true });
  }

  withClaraUsedInventory(): SimulationSession {
    return new SimulationSession({ ...this.props, claraUsedInventory: true });
  }

  withStatus(status: SimulationStatus): SimulationSession {
    return new SimulationSession({ ...this.props, status });
  }
}
