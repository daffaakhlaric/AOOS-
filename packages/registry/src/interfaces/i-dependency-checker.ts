export interface DependencyCheckResult {
  readonly ok: boolean;
  readonly missing: readonly string[];
  readonly circular: readonly string[][];
  /** Topologically-sorted load order, when `ok` is true. */
  readonly loadOrder: readonly string[];
}

/** Port for the intra-registry Dependency Checker — graph, circular detection, missing detection. */
export interface IDependencyChecker {
  check(dependenciesById: ReadonlyMap<string, readonly string[]>): DependencyCheckResult;
}
