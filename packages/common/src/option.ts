/**
 * Option<T> — an explicit "value present or absent" type, preferred over `null`/`undefined`
 * scattered through business logic (Constitution §5 Coding Standards).
 */
export type Option<T> = Readonly<{ some: true; value: T }> | Readonly<{ some: false }>;

export function some<T>(value: T): Option<T> {
  return { some: true, value };
}

export const none: Option<never> = { some: false };

export function isSome<T>(option: Option<T>): option is { some: true; value: T } {
  return option.some;
}

export function isNone<T>(option: Option<T>): option is { some: false } {
  return !option.some;
}

export function fromNullable<T>(value: T | null | undefined): Option<T> {
  return value === null || value === undefined ? none : some(value);
}

export function getOrElse<T>(option: Option<T>, fallback: T): T {
  return option.some ? option.value : fallback;
}

export function mapOption<T, U>(option: Option<T>, fn: (value: T) => U): Option<U> {
  return option.some ? some(fn(option.value)) : none;
}
