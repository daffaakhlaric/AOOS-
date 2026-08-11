import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

export interface ImpactEstimateInput {
  /** Plain-language description, e.g. "hemat Rp 1.2 juta" or "target -40% Rp/D3". */
  readonly description: string;
  /** Optional whole-IDR estimate, when the impact is a spend/savings figure. */
  readonly amountIDR?: number;
}

/** A decision's estimated business impact — always human-readable, optionally backed by a whole-IDR number. */
export class ImpactEstimate {
  private constructor(private readonly input: ImpactEstimateInput) {}

  static create(input: ImpactEstimateInput): Result<ImpactEstimate, ValidationError> {
    if (typeof input.description !== "string" || input.description.trim().length === 0) {
      return err(new ValidationError("ImpactEstimate.description must be a non-empty string"));
    }
    if (
      input.amountIDR !== undefined &&
      (!Number.isFinite(input.amountIDR) || !Number.isInteger(input.amountIDR))
    ) {
      return err(
        new ValidationError(
          `ImpactEstimate.amountIDR must be a whole-IDR integer when present, received: ${String(input.amountIDR)}`,
        ),
      );
    }
    return ok(new ImpactEstimate({ ...input }));
  }

  get description(): string {
    return this.input.description;
  }

  get amountIDR(): number | undefined {
    return this.input.amountIDR;
  }
}
