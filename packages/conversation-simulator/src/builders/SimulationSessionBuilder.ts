import { SimulationSession } from "../domain/entities/index.js";
import type { PersonaDifficulty, PersonaId } from "../domain/value-objects/index.js";
import { SessionId } from "../domain/value-objects/index.js";

/** Builder Pattern: starts a fresh `SimulationSession` for one persona (spec "builders/SimulationSessionBuilder.ts"). */
export class SimulationSessionBuilder {
  static start(
    personaId: PersonaId,
    personaDifficulty: PersonaDifficulty,
    now: Date,
  ): SimulationSession {
    const sessionId = SessionId.generate(personaId, now);
    return SimulationSession.start(sessionId, personaId, personaDifficulty, now.getTime());
  }
}
