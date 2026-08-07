/** Free-form tag bag attached to a recorded metric sample (e.g. `{ provider: "openai" }`). */
export type KnowledgeMetricTags = Readonly<Record<string, string>>;

/** A single (name, value) pair describing a computed metric result. */
export interface KnowledgeMetricValue {
  readonly name: string;
  readonly value: number;
  readonly unit: KnowledgeMetricUnit;
}

/** Units a computed metric value may be expressed in. */
export enum KnowledgeMetricUnit {
  Count = "count",
  Ratio = "ratio",
  Milliseconds = "milliseconds",
  Bytes = "bytes",
  Tokens = "tokens",
  Currency = "currency",
  Degree = "degree",
  Score = "score",
}

/** Injectable clock function returning epoch milliseconds — keeps time deterministic in tests. */
export type Clock = () => number;
