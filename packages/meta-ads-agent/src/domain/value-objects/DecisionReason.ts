import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** A human-readable, non-empty explanation of why a `CampaignDecision` was made — e.g. "rphChat Rp 23.500 > 2.5x avg (Rp 23.030), very clearly boros". */
export class DecisionReason {
  private constructor(private readonly text: string) {}

  static create(text: string): Result<DecisionReason, ValidationError> {
    if (typeof text !== "string" || text.trim().length === 0) {
      return err(new ValidationError("DecisionReason must be a non-empty string"));
    }
    return ok(new DecisionReason(text));
  }

  toString(): string {
    return this.text;
  }

  equals(other: DecisionReason): boolean {
    return this.text === other.text;
  }
}
