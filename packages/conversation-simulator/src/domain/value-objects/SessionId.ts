import type { PersonaId } from "./PersonaId.js";

let sequence = 0;

/** Resets the module-local sequence counter — test-only, so generated ids stay deterministic across specs. */
export function resetSessionIdSequence(): void {
  sequence = 0;
}

/** Identifies one full simulation run (spec "domain/value-objects/SessionId.ts"). Immutable value object, equal by string value. */
export class SessionId {
  private constructor(private readonly raw: string) {}

  /** Deterministic given `(personaId, now)` plus a monotonic in-process sequence — never `Math.random()`/`crypto` (constitution: simulations are fully in-memory and reproducible). */
  static generate(personaId: PersonaId, now: Date): SessionId {
    sequence += 1;
    return new SessionId(`sim-${personaId}-${now.getTime()}-${sequence}`);
  }

  static create(raw: string): SessionId {
    return new SessionId(raw);
  }

  toString(): string {
    return this.raw;
  }

  equals(other: SessionId): boolean {
    return this.raw === other.raw;
  }
}
