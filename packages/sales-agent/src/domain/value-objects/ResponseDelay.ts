import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/**
 * A simulated "Clara is typing…" delay in milliseconds, before a generated response is considered
 * ready to send — deterministic, not `Math.random()`-based (see the engineering report's
 * resolution #4: the whole response pipeline must stay reproducible in tests). `fromSeed` derives
 * a value in `[minMs, maxMs]` from an injected integer seed via a simple modulo spread, the same
 * injectable-determinism pattern `ResponseGenerator`'s pool selection uses.
 */
export class ResponseDelay {
  private constructor(private readonly ms: number) {}

  static create(ms: number): Result<ResponseDelay, ValidationError> {
    if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) {
      return err(
        new ValidationError(
          `ResponseDelay must be a non-negative finite number, received: ${String(ms)}`,
        ),
      );
    }
    return ok(new ResponseDelay(Math.round(ms)));
  }

  /** Deterministic delay in `[minMs, maxMs]`, derived from `seed` (e.g. a conversation's message count). */
  static fromSeed(seed: number, minMs: number, maxMs: number): ResponseDelay {
    const span = Math.max(0, maxMs - minMs);
    const normalizedSeed = Math.abs(Math.trunc(seed));
    const offset = span === 0 ? 0 : normalizedSeed % (span + 1);
    return new ResponseDelay(minMs + offset);
  }

  toMilliseconds(): number {
    return this.ms;
  }
}
