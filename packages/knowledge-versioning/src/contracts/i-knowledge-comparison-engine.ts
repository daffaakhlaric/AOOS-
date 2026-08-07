/** Interface only — no implementation in this package ("No diff engine."). An external engine that computes the comparison payload recorded on a `KnowledgeComparison`. */
export interface IKnowledgeComparisonEngine {
  compare(
    leftVersionId: string,
    rightVersionId: string,
  ): Readonly<Record<string, unknown>> | Promise<Readonly<Record<string, unknown>>>;
}
