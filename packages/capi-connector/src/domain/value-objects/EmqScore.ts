import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** Meta's Event Match Quality score — `[0, 10]`, higher is better match confidence. */
export class EmqScore {
  private constructor(private readonly score: number) {}

  static create(score: number): Result<EmqScore, ValidationError> {
    if (!Number.isFinite(score) || score < 0 || score > 10) {
      return err(new ValidationError(`EmqScore must be within [0, 10], received: ${score}`));
    }
    return ok(new EmqScore(score));
  }

  get value(): number {
    return this.score;
  }
}
