/** Who sent one `SimulationMessage` — the AI buyer persona or Jessy. */
export enum SimulationSpeaker {
  BUYER = "BUYER",
  JESSY = "JESSY",
}

/** One turn in a simulated conversation (spec "domain/entities/SimulationMessage.ts"). */
export interface SimulationMessage {
  readonly turn: number;
  readonly speaker: SimulationSpeaker;
  readonly text: string;
  readonly occurredAt: Date;
}
