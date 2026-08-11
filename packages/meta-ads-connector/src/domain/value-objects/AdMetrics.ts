import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import { Rph } from "./Rph.js";
import type { Spend } from "./Spend.js";

export interface AdMetricsInput {
  readonly spend: Spend;
  readonly impressions: number;
  readonly reach: number;
  readonly clicks: number;
  /** D1 — `messaging_conversation_started` (noise, not counted as a lead). */
  readonly conversations: number;
  /** 2 exchanges — "hangat" (warm), not counted as a lead. Defaults to 0 — see D3Calculator. */
  readonly d2: number;
  /** 3 exchanges — "serius" (serious) — PRIMARY METRIC, IS a lead. */
  readonly d3: number;
  /** 5 exchanges — "sangat hangat" (very warm) — IS a lead. Defaults to 0 — see D3Calculator. */
  readonly d5: number;
  /** `onsite_conversion.lead` — IS a lead. */
  readonly leadForm: number;
}

const NON_NEGATIVE_INTEGER_FIELDS = [
  "impressions",
  "reach",
  "clicks",
  "conversations",
  "d2",
  "d3",
  "d5",
  "leadForm",
] as const;

/**
 * Immutable Value Object bundling all Meta insight metrics for a single Ad plus AAOS's derived
 * lead metrics. `frequency` is computed as `impressions / reach`, safely returning `0` when
 * `reach === 0` (spec edge case: "Frequency division by zero"). `rphChat`/`rphD3`/`rphLead` are
 * `Rph` instances, which are themselves division-by-zero safe (see `Rph`).
 */
export class AdMetrics {
  readonly spend: Spend;
  readonly impressions: number;
  readonly reach: number;
  readonly frequency: number;
  readonly clicks: number;
  readonly conversations: number;
  readonly d2: number;
  readonly d3: number;
  readonly d5: number;
  readonly leadForm: number;
  readonly totalLead: number;
  readonly rphChat: Rph;
  readonly rphD3: Rph;
  readonly rphLead: Rph;

  private constructor(input: AdMetricsInput) {
    this.spend = input.spend;
    this.impressions = input.impressions;
    this.reach = input.reach;
    this.frequency = input.reach > 0 ? input.impressions / input.reach : 0;
    this.clicks = input.clicks;
    this.conversations = input.conversations;
    this.d2 = input.d2;
    this.d3 = input.d3;
    this.d5 = input.d5;
    this.leadForm = input.leadForm;
    this.totalLead = input.d3 + input.d5 + input.leadForm;
    const spendAmount = input.spend.toNumber();
    this.rphChat = Rph.calculate(spendAmount, input.conversations);
    this.rphD3 = Rph.calculate(spendAmount, input.d3);
    this.rphLead = Rph.calculate(spendAmount, this.totalLead);
  }

  static create(input: AdMetricsInput): Result<AdMetrics, ValidationError> {
    for (const field of NON_NEGATIVE_INTEGER_FIELDS) {
      const value = input[field];
      if (!Number.isFinite(value) || value < 0) {
        return err(
          new ValidationError(
            `AdMetrics.${field} must be a non-negative finite number, received: ${String(value)}`,
          ),
        );
      }
    }
    return ok(new AdMetrics(input));
  }
}
