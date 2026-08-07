/** Free-form, JSON-serializable metadata bag used throughout the domain. */
export type Metadata = Readonly<Record<string, unknown>>;

/** A caller-supplied weighted sub-score, consumed by the shared scoring utility. */
export interface WeightedSignal {
  readonly name: string;
  /** Value already normalized to the 0-100 range. */
  readonly value: number;
  /** Relative weight (any positive number — weights are normalized internally). */
  readonly weight: number;
}

/** A named lower-bound threshold band, e.g. `{ label: "Healthy", min: 80 }`. */
export interface ThresholdBand {
  readonly label: string;
  readonly min: number;
}
