/** Aggregate closing statistics returned by `GetClosingStats` (spec "Key Use Cases"). */
export interface ClosingStats {
  readonly totalClosings: number;
  readonly totalCommissionIdr: number;
  readonly avgCommissionIdr: number;
  readonly closingsByCampaign: Readonly<Record<string, number>>;
  /** Rp spent per SPK/closing, per campaign — design resolution #3. Only present for campaigns with at least 1 closing in the filtered window (divide-by-zero guard: 0 closings never produces a `NaN`/`Infinity` entry). */
  readonly rphSpkByCampaign: Readonly<Record<string, number>>;
  readonly closingsByBranch: Readonly<Record<string, number>>;
}
