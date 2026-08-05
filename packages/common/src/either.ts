/**
 * Either<L, R> — a general-purpose two-branch union, distinct from Result<T, E>: Result is
 * specifically success/failure semantics, Either is a neutral left/right disjunction (e.g.
 * "this Lead resolved to an existing Customer OR a new Customer draft").
 */
export type Either<L, R> =
  Readonly<{ tag: "left"; value: L }> | Readonly<{ tag: "right"; value: R }>;

export function left<L>(value: L): Either<L, never> {
  return { tag: "left", value };
}

export function right<R>(value: R): Either<never, R> {
  return { tag: "right", value };
}

export function isLeft<L, R>(either: Either<L, R>): either is { tag: "left"; value: L } {
  return either.tag === "left";
}

export function isRight<L, R>(either: Either<L, R>): either is { tag: "right"; value: R } {
  return either.tag === "right";
}

export function fold<L, R, T>(either: Either<L, R>, onLeft: (l: L) => T, onRight: (r: R) => T): T {
  return either.tag === "left" ? onLeft(either.value) : onRight(either.value);
}
