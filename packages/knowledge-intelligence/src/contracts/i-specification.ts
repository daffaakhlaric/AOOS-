/**
 * Specification-pattern contract used by the classification engine (and available for callers to
 * register additional predicates). `isSatisfiedBy` must be a pure, deterministic function of
 * `candidate` — no I/O, no hidden state.
 */
export interface ISpecification<T> {
  readonly name: string;
  isSatisfiedBy(candidate: T): boolean;
}
