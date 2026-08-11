let sequence = 0;

/** Resets the module-local sequence counter — test-only, so generated ids stay deterministic across specs. */
export function resetJudgementIdSequence(): void {
  sequence = 0;
}

/** Identifies one `JudgementResult` (spec "domain/value-objects/JudgementId.ts"). Immutable value object, equal by string value. */
export class JudgementId {
  private constructor(private readonly raw: string) {}

  /** Deterministic given `(sessionId, now)` plus a monotonic in-process sequence — never `Math.random()`/`crypto` (constitution: scoring is fully in-memory and reproducible). */
  static generate(sessionId: string, now: Date): JudgementId {
    sequence += 1;
    return new JudgementId(`judgement-${sessionId}-${now.getTime()}-${sequence}`);
  }

  static create(raw: string): JudgementId {
    return new JudgementId(raw);
  }

  toString(): string {
    return this.raw;
  }

  equals(other: JudgementId): boolean {
    return this.raw === other.raw;
  }
}
